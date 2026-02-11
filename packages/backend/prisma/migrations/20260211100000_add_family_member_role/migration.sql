-- Add family_member to MembershipRole enum
ALTER TYPE "MembershipRole" ADD VALUE 'family_member' AFTER 'member';
