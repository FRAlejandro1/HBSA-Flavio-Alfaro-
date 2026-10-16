// Pruebas de dividirSentencias: separacion de archivos SQL en sentencias, sin base de datos.
import { describe, expect, it } from 'vitest';
import { dividirSentencias } from '../../../src/scripts/migrador';

describe('dividirSentencias', () => {
  it('separa por punto y coma e ignora los comentarios de linea y de final de linea', () => {
    const sql = [
      '-- comentario inicial',
      'SET NAMES utf8mb4;',
      'CREATE TABLE a (',
      '  id INT, -- columna',
      '  PRIMARY KEY (id)',
      ') ENGINE=InnoDB;',
    ].join('\n');
    expect(dividirSentencias(sql)).toEqual([
      'SET NAMES utf8mb4',
      'CREATE TABLE a (\n  id INT,\n  PRIMARY KEY (id)\n) ENGINE=InnoDB',
    ]);
  });

  it('reconoce la sentencia aunque un comentario siga al punto y coma', () => {
    expect(dividirSentencias("SET time_zone = '-05:00'; -- hora de Ecuador")).toEqual([
      "SET time_zone = '-05:00'",
    ]);
  });

  it('respeta DELIMITER para los cuerpos de triggers', () => {
    const sql = [
      'DELIMITER $$',
      'CREATE TRIGGER t BEFORE UPDATE ON x',
      'FOR EACH ROW',
      'BEGIN',
      "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'no';",
      'END$$',
      'DELIMITER ;',
      'SELECT 1;',
    ].join('\n');
    expect(dividirSentencias(sql)).toEqual([
      "CREATE TRIGGER t BEFORE UPDATE ON x\nFOR EACH ROW\nBEGIN\n  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'no';\nEND",
      'SELECT 1',
    ]);
  });

  it('no trata como comentario un doble guion dentro de un texto entre comillas', () => {
    expect(dividirSentencias("INSERT INTO t VALUES ('a -- b');")).toEqual([
      "INSERT INTO t VALUES ('a -- b')",
    ]);
  });

  it('acepta saltos de linea de Windows', () => {
    expect(dividirSentencias('SELECT 1;\r\nSELECT 2;\r\n')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('conserva una ultima sentencia sin punto y coma', () => {
    expect(dividirSentencias('SELECT 1;\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });
});