-- ============================================================
-- 002_triggers.sql
-- Solo triggers que la BD debe garantizar por si sola.
-- ============================================================
DELIMITER $$

-- Bloquea UPDATE sobre la bitacora: la auditoria es inmutable
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log es de solo insercion';
END$$

-- Bloquea DELETE sobre la bitacora
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log es de solo insercion';
END$$

DELIMITER ;