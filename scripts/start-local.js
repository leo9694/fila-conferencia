// Identifica o ambiente antes do dotenv, sem editar credenciais ou o .env.
process.env.CALL_CLIENT_ENV = 'local';
require('../server');
