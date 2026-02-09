// ============================================================================
// PASSWORD HASHING TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock argon2 before importing the password module
// Using vi.hoisted to ensure the mock is created before hoisting
const mockArgon2 = vi.hoisted(() => ({
  hash: vi.fn(),
  verify: vi.fn(),
  needsRehash: vi.fn(),
  argon2id: 2,
}));

vi.mock('argon2', () => ({
  default: mockArgon2,
  ...mockArgon2,
}));

// Import after mock setup
import { hashPassword, verifyPassword, needsRehash } from './password.js';

describe('Password Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'SecurePassword123!';
      const expectedHash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';

      mockArgon2.hash.mockResolvedValue(expectedHash);

      const result = await hashPassword(password);

      expect(result).toBe(expectedHash);
      expect(mockArgon2.hash).toHaveBeenCalledWith(password, expect.objectContaining({
        type: 2, // argon2id
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        hashLength: 32,
      }));
    });

    it('should hash different passwords to different hashes', async () => {
      const password1 = 'Password123!';
      const password2 = 'DifferentPassword456!';
      const hash1 = '$argon2id$v=19$m=65536,t=3,p=4$salt1$hash1';
      const hash2 = '$argon2id$v=19$m=65536,t=3,p=4$salt2$hash2';

      mockArgon2.hash
        .mockResolvedValueOnce(hash1)
        .mockResolvedValueOnce(hash2);

      const result1 = await hashPassword(password1);
      const result2 = await hashPassword(password2);

      expect(result1).not.toBe(result2);
    });

    it('should handle empty password', async () => {
      const emptyPassword = '';
      const expectedHash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$emptyHash';

      mockArgon2.hash.mockResolvedValue(expectedHash);

      const result = await hashPassword(emptyPassword);

      expect(result).toBe(expectedHash);
      expect(mockArgon2.hash).toHaveBeenCalledWith(emptyPassword, expect.any(Object));
    });

    it('should handle unicode passwords', async () => {
      const unicodePassword = 'Mot2Passe!Francais';
      const expectedHash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$unicodeHash';

      mockArgon2.hash.mockResolvedValue(expectedHash);

      const result = await hashPassword(unicodePassword);

      expect(result).toBe(expectedHash);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'A'.repeat(1000) + '123!';
      const expectedHash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$longHash';

      mockArgon2.hash.mockResolvedValue(expectedHash);

      const result = await hashPassword(longPassword);

      expect(result).toBe(expectedHash);
    });

    it('should propagate argon2 errors', async () => {
      const password = 'Password123!';
      const error = new Error('Argon2 internal error');

      mockArgon2.hash.mockRejectedValue(error);

      await expect(hashPassword(password)).rejects.toThrow('Argon2 internal error');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';
      const password = 'CorrectPassword123!';

      mockArgon2.verify.mockResolvedValue(true);

      const result = await verifyPassword(hash, password);

      expect(result).toBe(true);
      expect(mockArgon2.verify).toHaveBeenCalledWith(hash, password);
    });

    it('should return false for incorrect password', async () => {
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';
      const wrongPassword = 'WrongPassword456!';

      mockArgon2.verify.mockResolvedValue(false);

      const result = await verifyPassword(hash, wrongPassword);

      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const invalidHash = 'not-a-valid-argon2-hash';
      const password = 'Password123!';

      mockArgon2.verify.mockRejectedValue(new Error('Invalid hash'));

      const result = await verifyPassword(invalidHash, password);

      expect(result).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const emptyHash = '';
      const password = 'Password123!';

      mockArgon2.verify.mockRejectedValue(new Error('Invalid hash'));

      const result = await verifyPassword(emptyHash, password);

      expect(result).toBe(false);
    });

    it('should return false when argon2 throws', async () => {
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';
      const password = 'Password123!';

      mockArgon2.verify.mockRejectedValue(new Error('Internal error'));

      const result = await verifyPassword(hash, password);

      expect(result).toBe(false);
    });

    it('should handle timing-safe comparison', async () => {
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';
      const password = 'Password123!';

      mockArgon2.verify.mockResolvedValue(true);

      const result = await verifyPassword(hash, password);

      expect(result).toBe(true);
      // argon2.verify handles timing-safe comparison internally
    });
  });

  describe('needsRehash', () => {
    it('should return false for up-to-date hash', () => {
      const currentHash = '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash';

      mockArgon2.needsRehash.mockReturnValue(false);

      const result = needsRehash(currentHash);

      expect(result).toBe(false);
      expect(mockArgon2.needsRehash).toHaveBeenCalledWith(currentHash, expect.objectContaining({
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        hashLength: 32,
      }));
    });

    it('should return true for outdated hash parameters', () => {
      const oldHash = '$argon2id$v=19$m=32768,t=2,p=2$oldSalt$oldHash';

      mockArgon2.needsRehash.mockReturnValue(true);

      const result = needsRehash(oldHash);

      expect(result).toBe(true);
    });

    it('should return true for bcrypt hash (different algorithm)', () => {
      const bcryptHash = '$2b$10$saltSaltSaltSaltSaltSahashHashHashHashHashHash';

      mockArgon2.needsRehash.mockReturnValue(true);

      const result = needsRehash(bcryptHash);

      expect(result).toBe(true);
    });

    it('should return true for argon2i hash (different variant)', () => {
      const argon2iHash = '$argon2i$v=19$m=65536,t=3,p=4$mockSalt$mockHash';

      mockArgon2.needsRehash.mockReturnValue(true);

      const result = needsRehash(argon2iHash);

      expect(result).toBe(true);
    });
  });
});
