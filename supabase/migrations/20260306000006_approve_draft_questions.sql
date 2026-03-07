-- Approve all existing draft questions so they appear in practice
UPDATE sp_questions SET generation_status = 'approved' WHERE generation_status = 'draft';
