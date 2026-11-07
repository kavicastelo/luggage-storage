INSERT INTO "roles" (code, name, description, is_system)
VALUES 
  ('SUPERADMIN', 'Super Administrator', 'Full executive platform governance and financial management', true),
  ('SUPPORT', 'Customer Support', 'Customer support agent with restricted read and ticket handling privileges', true),
  ('HOST_OWNER', 'Host Owner', 'Business owner authorized to manage locations, staff, and pricing', true),
  ('HOST_STAFF', 'Host Staff', 'Location attendant authorized for check-in / check-out scanning', true)
ON CONFLICT (code) DO NOTHING;

