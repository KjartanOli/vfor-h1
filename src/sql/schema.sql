DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS games;

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  category VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  studio VARCHAR(30) NOT NULL,
  year INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games (id),
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5)
);
