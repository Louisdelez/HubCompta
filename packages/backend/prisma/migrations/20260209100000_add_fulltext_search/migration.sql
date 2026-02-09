-- ============================================================================
-- FULL-TEXT SEARCH MIGRATION
-- Adds tsvector columns and GIN indexes for PostgreSQL full-text search
-- ============================================================================

-- Add search_vector column to transactions table
ALTER TABLE "transactions" ADD COLUMN "search_vector" TSVECTOR;

-- Create trigger function to update transaction search_vector
CREATE OR REPLACE FUNCTION transactions_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.description, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.notes, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transactions
CREATE TRIGGER transactions_search_vector_trigger
  BEFORE INSERT OR UPDATE OF description, notes
  ON "transactions"
  FOR EACH ROW
  EXECUTE FUNCTION transactions_search_vector_update();

-- Create GIN index on transactions search_vector
CREATE INDEX "transactions_search_vector_idx" ON "transactions" USING GIN ("search_vector");

-- Update existing transactions
UPDATE "transactions"
SET search_vector =
  setweight(to_tsvector('french', COALESCE(description, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(notes, '')), 'B');

-- Add search_vector column to documents table
ALTER TABLE "documents" ADD COLUMN "search_vector" TSVECTOR;

-- Add content column for OCR text (optional, can be populated later)
ALTER TABLE "documents" ADD COLUMN "content" TEXT;

-- Create trigger function to update document search_vector
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.filename, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for documents
CREATE TRIGGER documents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF filename, content
  ON "documents"
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_update();

-- Create GIN index on documents search_vector
CREATE INDEX "documents_search_vector_idx" ON "documents" USING GIN ("search_vector");

-- Update existing documents
UPDATE "documents"
SET search_vector =
  setweight(to_tsvector('french', COALESCE(filename, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(content, '')), 'B');

-- Add search_vector column to contacts table
ALTER TABLE "contacts" ADD COLUMN "search_vector" TSVECTOR;

-- Add company column to contacts table (using address as company context can be added)
ALTER TABLE "contacts" ADD COLUMN "company" VARCHAR(200);

-- Create trigger function to update contact search_vector
CREATE OR REPLACE FUNCTION contacts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.siret, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contacts
CREATE TRIGGER contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, email, company, siret
  ON "contacts"
  FOR EACH ROW
  EXECUTE FUNCTION contacts_search_vector_update();

-- Create GIN index on contacts search_vector
CREATE INDEX "contacts_search_vector_idx" ON "contacts" USING GIN ("search_vector");

-- Update existing contacts
UPDATE "contacts"
SET search_vector =
  setweight(to_tsvector('french', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(email, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(company, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(siret, '')), 'C');

-- ============================================================================
-- SEARCH HISTORY TABLE - For suggestions and autocomplete
-- ============================================================================

-- Create search history table
CREATE TABLE "search_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "types" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- Create indexes on search history
CREATE INDEX "search_history_workspace_user_idx" ON "search_history"("workspace_id", "user_id");
CREATE INDEX "search_history_query_idx" ON "search_history"("query");
CREATE INDEX "search_history_created_at_idx" ON "search_history"("created_at");

-- Add foreign keys
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- COMMON SEARCH TERMS TABLE - For suggestions
-- ============================================================================

-- Create common terms table (aggregated from search history)
CREATE TABLE "search_terms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "term" VARCHAR(100) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_terms_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on workspace + term
CREATE UNIQUE INDEX "search_terms_workspace_term_idx" ON "search_terms"("workspace_id", "term");

-- Create index for suggestions lookup
CREATE INDEX "search_terms_count_idx" ON "search_terms"("workspace_id", "count" DESC);

-- Add foreign key
ALTER TABLE "search_terms" ADD CONSTRAINT "search_terms_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
