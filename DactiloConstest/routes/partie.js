var app = require('express');
var router = app.Router();

var MongoClient = require("mongodb").MongoClient;
var db = null;

let rooms = [];


MongoClient.connect("mongodb://mongodb:27017", {useUnifiedTopology: true}, function (err, client) {
    console.log(err)
    db = client.db("dactilocontest");
});

function diffSecondes(t1, t2) {
    var dif = t1.getTime() - t2.getTime();

    var Seconds_from_T1_to_T2 = dif / 1000;
    return Math.abs(Seconds_from_T1_to_T2);
}

async function playerExist(pseudo, salon) {
    return !!(await db.collection("players").findOne({pseudo: pseudo, salon: salon}));
}

async function ajouterJoueur(pseudo, salon) {
    var nouveauJoueur = {pseudo: pseudo, salle: salon};

    let exist = await playerExist(pseudo, salon);

    if (!exist) {
        return await db.collection("players").insertOne(nouveauJoueur, null, function (error, results) {
            if (error) throw error;
        });
    }

}

function supprimerJoueur(pseudo, salon) {
    var nouveauJoueur = {pseudo: pseudo, salle: salon};

    db.collection("players").deleteMany(nouveauJoueur, function (error, results) {
        if (error) throw error;
    });
}

async function joueursDansSalon(titre) {
    var salon = {salle: titre};

    return db.collection("players").find(salon).toArray();
}


async function getWordList() {
    return await db.collection("words").aggregate([{$sample: {size: 3}}]).toArray();
}


/* GET home page. */
router.get('/', function (req, res) {
    res.render('partie', {title: 'Dactilo Contest'});
});


module.exports = {
    router,
    start: function (io) {
        function getSocketWhithId(id) {
            var ns = io.of("/");
            return ns.sockets.get(id);
        }


        io.on('connection', function (socket) {
            socket.on('setPseudo', function (pseudo) {
                socket.pseudo = pseudo;
            })

            socket.on('rejoindreSalon', function (titre) {
                if (rooms[titre] == null) {
                    socket.join(titre);
                    socket.isAdmin = true;

                    socket.emit('setAdmin');


                    rooms[titre] = {
                        name: titre,
                        players: [socket.pseudo],
                        admin: socket.pseudo,
                        start: null,
                        gameStarted: false,
                        wordList: [],
                        scores: [],
                        maxwords: 3,
                        playerFinished: [],
                    }

                } else {
                    let room = rooms[titre];
                    socket.join(titre);
                    socket.salon = titre;
                    socket.isAdmin = false;
                    if (!room.players.includes(socket.pseudo)) {
                        room.players.push(socket.pseudo);

                    }
                }
                io.to(titre).emit('afficherJoueurs', rooms[titre].players);
            });

            socket.on('commencerPartie', function (salon) {
                getWordList().then(wordList => {
                    let room = rooms[salon];
                    room.gameStarted = true;
                    room.start = new Date();
                    room.wordList = wordList;
                    room.scores = [];
                    room.playerFinished = [];

                    for (let i = 0; i < room.players.length; i++) {
                        room.scores[room.players[i]] = [];
                    }
                    io.to(salon).emit('afficherJoueurs', room.players)
                    io.to(salon).emit('afficherProgression',room.players,0)
                    io.to(salon).emit('premierMot');
                });
            });

            socket.on('demanderMot', (salon, index) => {
                let room = rooms[salon];
                let word;
                if (index === 0) {
                    word = room.wordList[index].Word;
                } else
                    word = room.wordList[room.scores[socket.pseudo].length].word;

                room.scores[socket.pseudo].push({
                    pseudo: socket.pseudo,
                    word: word,
                    givenAt: new Date(),
                    index: 0,
                    completedAt: null
                });

                socket.emit('afficherMot', word);

            });

            socket.on('saisieMot', function (salon, saisieJoueur) {
                let room = rooms[salon];
                let scoreDuJoueur = room.scores[socket.pseudo];
                let currentWord = room.wordList[scoreDuJoueur.length - 1].Word;

                if (currentWord.toLowerCase() === saisieJoueur.toLowerCase()) {
                    let completedTime = new Date();
                    scoreDuJoueur[scoreDuJoueur.length - 1].completedAt = completedTime;

                    io.in(salon).emit('afficherProgression', [socket.pseudo], scoreDuJoueur.length )

                    //On ajoute le mot suivant
                    if (scoreDuJoueur.length < room.maxwords) {
                        let nextWord = room.wordList[scoreDuJoueur.length].Word;
                        room.scores[socket.pseudo].push({
                            pseudo: socket.pseudo,
                            word: nextWord,
                            givenAt: new Date(),
                            index: scoreDuJoueur.length,
                            completedAt: null
                        });

                        socket.emit('afficherMot', nextWord);
                    } else {
                        let totalSeconds = diffSecondes(room.start, completedTime);

                        room.playerFinished.push(socket.pseudo);


                        io.in(salon).emit('afficherScoreDuJoueur', totalSeconds, socket.pseudo);
                        socket.emit('terminerPartieJoueur', totalSeconds);

                        //Partie terminée
                        if (room.playerFinished.length === room.players.length) {
                            let bestTime;
                            let lastsWords = [];
                            for (var key in room.scores) {
                                var obj = room.scores;

                                for (let i = 0; i < obj[key].length; i++) {
                                    if (obj[key][i].index + 1 === room.maxwords) {
                                        if (bestTime != null) {
                                            if (bestTime.completedAt > obj[key][i].completedAt) {
                                                bestTime = obj[key][i];
                                                bestTime.totalTime = diffSecondes(room.start, bestTime.completedAt);
                                            }
                                        } else {
                                            bestTime = obj[key][i];
                                        }
                                        obj[key][i].totalTime = diffSecondes(room.start, obj[key][i].completedAt);
                                        lastsWords.push(obj[key][i]);
                                    }
                                }
                            }

                            io.in(salon).emit('partieTerminee',bestTime,lastsWords);
                        }

                    }
                    socket.emit('resetSaisie');
                } else {
                    socket.emit('resetSaisie');
                }
            });

            socket.on('disconnect', function (reason) {
                let titre = socket.salon;
                let room = rooms[titre];
                if (room != null) {
                    if (room.admin === socket.pseudo) {
                        const index = rooms.indexOf(titre);
                        rooms.splice(index, 1)
                    } else {
                        const index = room.players.indexOf(socket.pseudo);
                        room.players.splice(index, 1)
                        io.to(socket.salon).emit('afficherJoueurs',room.players);
                    }
                }
            })
        });
    }
};
