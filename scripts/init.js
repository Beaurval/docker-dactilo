db = db.getSiblingDB('admin')

db.createUser({
  user: "dacti",
  pwd: "1234",
  roles: [{role: "readWrite", db: "dactilocontest"}]
});

db = db.getSiblingDB("dactilocontest");

db.createCollection("rooms");
db.createCollection("players");
db.createCollection("scores");
db.createCollection("words");
