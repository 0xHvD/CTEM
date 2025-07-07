-- Datenbank und Benutzer erstellen (falls nicht durch Docker gemacht)
-- CREATE DATABASE ctem_db;
-- CREATE USER ctem_user WITH PASSWORD 'ctem_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE ctem_db TO ctem_user;

-- Extensions für PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Kommentar: Tabellen werden von Sequelize erstellt