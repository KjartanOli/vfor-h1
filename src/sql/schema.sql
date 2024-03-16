DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS games;

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  category VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  studio VARCHAR(30) NOT NULL,
  year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(30) NOT NULL,
  password CHAR(97) NOT NULL,
  admin BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER REFERENCES users(id),
  game_id INTEGER REFERENCES games (id),
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
  PRIMARY KEY (user_id, game_id)
);

CREATE OR REPLACE FUNCTION delete_user_ratings()
RETURNS TRIGGER AS $$
BEGIN
DELETE FROM ratings
WHERE user_id = OLD.id;
RETURN OLD;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_game_ratings()
RETURNS TRIGGER AS $$
BEGIN
DELETE FROM ratings
WHERE game_id = OLD.id;
RETURN OLD;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER before_game_delete BEFORE DELETE ON games
FOR EACH ROW
EXECUTE FUNCTION delete_game_ratings();

CREATE OR REPLACE TRIGGER before_user_delete BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION delete_user_ratings();

INSERT INTO users (username, name, password, admin)
VALUES ('admin', 'Admin', '$argon2id$v=19$m=19456,t=2,p=1$aqsMPVfdOwBeyngRoxTbFg$YX2YoRykR1MPAzP75E+UlCPL0GHtr/m0QzQVQoJcVeA', true);
