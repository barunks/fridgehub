-- Reference schema only. Production containers run Alembic migrations instead of mounting this file.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  family_role VARCHAR(50),
  token_version INT NOT NULL DEFAULT 0,
  max_devices INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_email (email),
  INDEX idx_username (username)
);

CREATE TABLE IF NOT EXISTS families (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  family_name VARCHAR(255) NOT NULL,
  home_base VARCHAR(255) NOT NULL DEFAULT 'Singapore',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Singapore',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_family_name (family_name)
);

CREATE TABLE IF NOT EXISTS family_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  initial VARCHAR(4) DEFAULT '?',
  color_class VARCHAR(64) DEFAULT 'bg-slate-500',
  status VARCHAR(255) DEFAULT 'Active',
  points INT DEFAULT 0,
  dietary_notes JSON,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_family_user (family_id, user_id),
  INDEX idx_family (family_id)
);

CREATE TABLE IF NOT EXISTS grocery_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frequency_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  frequency_name VARCHAR(20) NOT NULL UNIQUE,
  days_interval INT NOT NULL,
  display_order INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grocery_list_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  list_name VARCHAR(100) NOT NULL,
  list_type VARCHAR(50) DEFAULT 'standard',
  description VARCHAR(255) DEFAULT '',
  color_class VARCHAR(64) DEFAULT 'bg-blue-500',
  family_id INT NOT NULL,
  created_by INT,
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_list_per_family (list_name, family_id),
  INDEX idx_family (family_id)
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  item_number VARCHAR(20) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  list_type_id INT NOT NULL,
  quantity DECIMAL(10, 2),
  unit VARCHAR(20),
  purchase_frequency VARCHAR(20) DEFAULT 'weekly',
  current_stock BOOLEAN DEFAULT FALSE,
  start_date DATE NOT NULL,
  expiry_date DATE,
  notes TEXT,
  family_id INT NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (list_type_id) REFERENCES grocery_list_types(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_item_per_list (item_name, list_type_id),
  INDEX idx_family (family_id),
  INDEX idx_list_type (list_type_id),
  INDEX idx_grocery_items_frequency (purchase_frequency),
  INDEX idx_grocery_items_stock (current_stock)
);

CREATE TABLE IF NOT EXISTS grocery_purchase_cycles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  list_type_id INT NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  family_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (list_type_id) REFERENCES grocery_list_types(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  UNIQUE KEY unique_cycle (list_type_id, frequency, cycle_start_date),
  INDEX idx_family (family_id),
  INDEX idx_cycle_dates (cycle_start_date, cycle_end_date)
);

CREATE TABLE IF NOT EXISTS grocery_sub_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  purchase_cycle_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10, 2),
  unit VARCHAR(20),
  is_purchased BOOLEAN DEFAULT FALSE,
  purchased_quantity DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  is_adhoc BOOLEAN DEFAULT FALSE,
  carried_forward BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_cycle_id) REFERENCES grocery_purchase_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES grocery_items(id) ON DELETE CASCADE,
  UNIQUE KEY unique_sub_list_item (purchase_cycle_id, item_id),
  INDEX idx_cycle (purchase_cycle_id),
  INDEX idx_sublist_purchased (is_purchased)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending',
  due_date DATETIME,
  reminder_date DATETIME,
  recurrence_type VARCHAR(20) DEFAULT 'none',
  recurrence_interval INT DEFAULT 1,
  recurrence_end_date DATETIME,
  family_id INT NOT NULL,
  assigned_to INT,
  created_by INT,
  category VARCHAR(100),
  action_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_family (family_id),
  INDEX idx_tasks_due_date_status (due_date, status),
  INDEX idx_tasks_assigned (assigned_to)
);

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  recipe_name VARCHAR(255) NOT NULL,
  description TEXT,
  ingredients JSON,
  instructions TEXT,
  prep_time INT,
  cook_time INT,
  servings INT,
  difficulty VARCHAR(20),
  cuisine VARCHAR(100),
  dietary_tags JSON,
  family_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_family (family_id),
  INDEX idx_recipe_name (recipe_name)
);

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  family_id INT,
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(30) NOT NULL DEFAULT 'browser',
  platform VARCHAR(100),
  user_agent VARCHAR(512),
  ip_address VARCHAR(45),
  last_ip VARCHAR(45),
  last_user_agent VARCHAR(512),
  is_revoked BOOLEAN DEFAULT FALSE,
  is_trusted BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
  UNIQUE KEY idx_devices_user_device (user_id, device_id),
  INDEX idx_devices_user_id (user_id),
  INDEX idx_devices_family_id (family_id)
);

CREATE TABLE IF NOT EXISTS device_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  device_id INT NOT NULL,
  user_id INT NOT NULL,
  family_id INT,
  jti VARCHAR(36) NOT NULL,
  token_type VARCHAR(10) NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  ip_address VARCHAR(45),
  user_agent VARCHAR(512),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
  INDEX idx_device_sessions_device (device_id),
  UNIQUE KEY idx_device_sessions_jti (jti)
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  family_id INT NOT NULL,
  plan_date DATE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  meal_type VARCHAR(20),
  meal_name VARCHAR(255),
  description TEXT,
  calories INT,
  prep_time INT,
  recipe_id INT,
  color_class VARCHAR(64) DEFAULT 'bg-blue-500',
  created_by INT,
  assigned_to INT,
  meal_plan_scope VARCHAR(128) NOT NULL DEFAULT 'family',
  dietary_flags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_meal_scope (family_id, plan_date, meal_type, meal_plan_scope),
  INDEX idx_meal_plan_family_date (family_id, plan_date),
  INDEX idx_meal_assigned_to (assigned_to),
  INDEX idx_meal_plan_scope (meal_plan_scope)
);

CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  day_of_week VARCHAR(20),
  meal_type VARCHAR(20),
  meal_name VARCHAR(255),
  description TEXT,
  calories INT,
  prep_time INT,
  recipe_id INT,
  family_id INT,
  template_scope VARCHAR(128) NOT NULL DEFAULT 'global',
  is_global BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_template_scope (template_scope, template_name, day_of_week, meal_type),
  INDEX idx_family (family_id),
  INDEX idx_day (day_of_week),
  INDEX idx_template_scope (template_scope)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  user_id INT,
  family_id INT,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  changes JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_family (family_id),
  INDEX idx_audit_created (created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  family_id INT,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  owner_id INT,
  tag VARCHAR(50) DEFAULT 'family',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_family (family_id)
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  value VARCHAR(100) NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  INDEX idx_family (family_id)
);

-- Enforce max devices per user at DB level
DELIMITER //
CREATE TRIGGER trg_enforce_max_devices
BEFORE INSERT ON devices
FOR EACH ROW
BEGIN
    DECLARE device_count INT;
    DECLARE user_max INT;

    SELECT COUNT(*) INTO device_count
    FROM devices
    WHERE user_id = NEW.user_id AND is_active = 1 AND is_revoked = 0;

    SELECT COALESCE(max_devices, 5) INTO user_max
    FROM users
    WHERE id = NEW.user_id;

    IF device_count >= user_max THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Maximum number of devices reached for this user';
    END IF;
END//
DELIMITER ;
