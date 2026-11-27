-- Run once as root (MySQL Workbench: File > Open SQL Script, then Execute).
-- Creates the database and the user in .env.example. Change the password in both places if you like.
CREATE DATABASE IF NOT EXISTS graphmart;
CREATE USER IF NOT EXISTS 'graphmart'@'localhost' IDENTIFIED BY 'graphmart123';
CREATE USER IF NOT EXISTS 'graphmart'@'127.0.0.1' IDENTIFIED BY 'graphmart123';
GRANT ALL PRIVILEGES ON graphmart.* TO 'graphmart'@'localhost';
GRANT ALL PRIVILEGES ON graphmart.* TO 'graphmart'@'127.0.0.1';
