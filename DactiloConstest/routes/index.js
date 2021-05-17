var app = require('express');
var router = app.Router();

var MongoClient = require("mongodb").MongoClient;
var db = null;

MongoClient.connect("mongodb://192.168.32.131:27017",{useUnifiedTopology: true}, function (err, client) {
    console.log("Connected successfully to server");
    db = client.db("dactilocontest");
});


/* GET home page. */
router.get('/', function (req, res) {
    db.collection("rooms").find().toArray((error, result) => {
        res.render('index', {title: 'Dactilo contest', rooms: result});
    })
});




module.exports = router;
