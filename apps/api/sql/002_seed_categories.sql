INSERT INTO categories (id, name) VALUES
  ('menage', 'Ménage'),
  ('reparations', 'Petites réparations'),
  ('exterieur', 'Terrain & extérieur'),
  ('demenagement', 'Déménagement'),
  ('deneigement', 'Déneigement'),
  ('animaux', 'Animaux'),
  ('voiture', 'Voiture')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
