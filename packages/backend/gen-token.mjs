import { createSigner } from 'fast-jwt';

const secret = 'development_jwt_secret_key_at_least_32_characters_long';
const signer = createSigner({ key: secret, expiresIn: 3600000, algorithm: 'HS256' });

const payload = {
  sub: '6d3d8c55-63c8-4b94-9b94-4326ab10eaba',
  email: 'test@hubcompta.local',
  deviceId: 'test-device-cli'
};

console.log(signer(payload));
