-- GraphMart "before" picture: the normalised MySQL model of the legacy application.
-- It is deliberately well designed and properly indexed, so benchmark comparisons are fair.
-- Statements are separated by a semicolon at the end of a line (the seed script splits on that).

CREATE TABLE users (
  id              INT UNSIGNED PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL,
  city            VARCHAR(80)  NOT NULL,
  country         VARCHAR(80)  NOT NULL,
  tier            ENUM('bronze','silver','gold') NOT NULL,
  created_at      DATETIME(3)  NOT NULL,
  referred_by_id  INT UNSIGNED NULL,
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_referred_by (referred_by_id),
  KEY ix_users_city (city),
  CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by_id) REFERENCES users (id)
);

CREATE TABLE user_interests (
  user_id   INT UNSIGNED NOT NULL,
  interest  VARCHAR(60)  NOT NULL,
  PRIMARY KEY (user_id, interest),
  CONSTRAINT fk_interest_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE addresses (
  id       INT UNSIGNED PRIMARY KEY,
  user_id  INT UNSIGNED NOT NULL,
  label    VARCHAR(40)  NOT NULL,
  street   VARCHAR(160) NOT NULL,
  city     VARCHAR(80)  NOT NULL,
  zip      VARCHAR(20)  NOT NULL,
  KEY ix_addresses_user (user_id),
  KEY ix_addresses_location (street, city, zip),
  CONSTRAINT fk_address_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE categories (
  id         INT UNSIGNED PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  parent_id  INT UNSIGNED NULL,
  KEY ix_categories_parent (parent_id),
  CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES categories (id)
);

CREATE TABLE brands (
  id    INT UNSIGNED PRIMARY KEY,
  name  VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_brands_name (name)
);

CREATE TABLE products (
  id            INT UNSIGNED PRIMARY KEY,
  sku           VARCHAR(40)   NOT NULL,
  name          VARCHAR(200)  NOT NULL,
  description   TEXT          NOT NULL,
  category_id   INT UNSIGNED  NOT NULL,
  brand_id      INT UNSIGNED  NOT NULL,
  price_cents   INT UNSIGNED  NOT NULL,
  stock         INT           NOT NULL,
  rating_avg    DECIMAL(4,2)  NOT NULL DEFAULT 0,
  rating_count  INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at    DATETIME(3)   NOT NULL,
  UNIQUE KEY uq_products_sku (sku),
  KEY ix_products_category_price (category_id, price_cents),
  KEY ix_products_brand_price (brand_id, price_cents),
  KEY ix_products_price (price_cents),
  FULLTEXT KEY ft_products (name, description),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_product_brand FOREIGN KEY (brand_id) REFERENCES brands (id)
);

-- Entity-Attribute-Value: the classic relational workaround for per-category product attributes.
CREATE TABLE attribute_definitions (
  id    INT UNSIGNED PRIMARY KEY,
  name  VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_attribute_name (name)
);

CREATE TABLE product_attributes (
  product_id    INT UNSIGNED  NOT NULL,
  attribute_id  INT UNSIGNED  NOT NULL,
  value_text    VARCHAR(160)  NULL,
  value_number  DECIMAL(14,3) NULL,
  value_bool    TINYINT(1)    NULL,
  PRIMARY KEY (product_id, attribute_id),
  KEY ix_pa_text (attribute_id, value_text, product_id),
  KEY ix_pa_number (attribute_id, value_number, product_id),
  KEY ix_pa_bool (attribute_id, value_bool, product_id),
  CONSTRAINT fk_pa_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_pa_attribute FOREIGN KEY (attribute_id) REFERENCES attribute_definitions (id)
);

CREATE TABLE tags (
  id    INT UNSIGNED PRIMARY KEY,
  name  VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_tags_name (name)
);

CREATE TABLE product_tags (
  product_id  INT UNSIGNED NOT NULL,
  tag_id      INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, tag_id),
  KEY ix_product_tags_tag (tag_id, product_id),
  CONSTRAINT fk_pt_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_pt_tag FOREIGN KEY (tag_id) REFERENCES tags (id)
);

CREATE TABLE orders (
  id                   INT UNSIGNED PRIMARY KEY,
  user_id              INT UNSIGNED NOT NULL,
  status               ENUM('paid','shipped','delivered','cancelled') NOT NULL,
  created_at           DATETIME(3)  NOT NULL,
  total_cents          INT UNSIGNED NOT NULL,
  payment_method       ENUM('card','paypal','cash_on_delivery') NOT NULL,
  card_fingerprint     VARCHAR(40)  NULL,
  device_id            VARCHAR(40)  NOT NULL,
  shipping_address_id  INT UNSIGNED NOT NULL,
  KEY ix_orders_user_created (user_id, created_at),
  KEY ix_orders_created (created_at),
  KEY ix_orders_status_created (status, created_at),
  KEY ix_orders_device (device_id, user_id),
  KEY ix_orders_card (card_fingerprint, user_id),
  KEY ix_orders_address (shipping_address_id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_order_address FOREIGN KEY (shipping_address_id) REFERENCES addresses (id)
);

CREATE TABLE order_items (
  order_id          INT UNSIGNED NOT NULL,
  line_no           TINYINT UNSIGNED NOT NULL,
  product_id        INT UNSIGNED NOT NULL,
  product_name      VARCHAR(200) NOT NULL,
  unit_price_cents  INT UNSIGNED NOT NULL,
  quantity          SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (order_id, line_no),
  KEY ix_items_product (product_id, order_id),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE reviews (
  id             INT UNSIGNED PRIMARY KEY,
  product_id     INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  rating         TINYINT UNSIGNED NOT NULL,
  title          VARCHAR(160) NOT NULL,
  body           TEXT         NOT NULL,
  helpful_votes  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME(3)  NOT NULL,
  KEY ix_reviews_product_created (product_id, created_at),
  KEY ix_reviews_user_product (user_id, product_id),
  CONSTRAINT fk_review_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE product_views (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  viewed_at   DATETIME(3)  NOT NULL,
  KEY ix_views_user_product (user_id, product_id),
  KEY ix_views_product (product_id, viewed_at),
  CONSTRAINT fk_view_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_view_product FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE follows (
  follower_id  INT UNSIGNED NOT NULL,
  followee_id  INT UNSIGNED NOT NULL,
  since        DATETIME(3)  NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  KEY ix_follows_followee (followee_id, follower_id),
  CONSTRAINT fk_follow_follower FOREIGN KEY (follower_id) REFERENCES users (id),
  CONSTRAINT fk_follow_followee FOREIGN KEY (followee_id) REFERENCES users (id)
);

CREATE TABLE warehouses (
  id    INT UNSIGNED PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  city  VARCHAR(80)  NOT NULL,
  lat   DECIMAL(9,6) NOT NULL,
  lng   DECIMAL(9,6) NOT NULL
);

CREATE TABLE warehouse_stock (
  warehouse_id  INT UNSIGNED NOT NULL,
  product_id    INT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED NOT NULL,
  PRIMARY KEY (warehouse_id, product_id),
  KEY ix_stock_product (product_id, warehouse_id),
  CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id),
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE routes (
  from_id       INT UNSIGNED NOT NULL,
  to_id         INT UNSIGNED NOT NULL,
  distance_km   INT UNSIGNED NOT NULL,
  duration_min  INT UNSIGNED NOT NULL,
  PRIMARY KEY (from_id, to_id),
  CONSTRAINT fk_route_from FOREIGN KEY (from_id) REFERENCES warehouses (id),
  CONSTRAINT fk_route_to FOREIGN KEY (to_id) REFERENCES warehouses (id)
);
