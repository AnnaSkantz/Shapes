//Import modules
var express = require('express');
var socket = require('socket.io');

var expApp = express();

//listen on port 3010
var server = expApp.listen(3010);

//Let expApp host the files in the public directory
expApp.use(express.static('public'));
console.log("socket server running");

//create I/O-object
var io = socket(server);

//When socket recieves "connection", do function handleNewConnection
io.sockets.on('connection', handleNewConnection);

function Game(players, layout, gameOn) {
    this.players = players;
    this.layout = layout;
    this.gameOn = gameOn;
}
function Room(left, right, up, down, door, items) {
    this.left = left;
    this.right = right;
    this.up = up;
    this.down = down;
    this.door = door;
    this.items = items;
}
function Door(left, right, up, down, open) {
    this.left = left;
    this.right = right;
    this.up = up;
    this.down = down;
    this.open = open;
}
function Player(playing, x, y, id, item, inRoom) {
    this.playing = playing;
    this.x = x;
    this.y = y;
    this.id = id;
    this.item = item;
    this.inRoom = inRoom;
}
function Item(shape, x, y) {
    this.shape = shape;
    this.x = x;
    this.y = y;
}

//Create a new game
var game = new Game(new Array(), createRooms(), 0);
var players;

//Function that is called when a new socket connection is accepted
function handleNewConnection(socket) {
    console.log('New connection: ' + socket.id);
    players = game.players;
    //Disconnect socket if there are already two players connected
    if(players.length == 2){

        socket.emit('message','tooMany');
        socket.disconnect();
    } 
    //Push player object to array
    players.push(createPlayer(socket.id, players.length));
    
    //When server recieves message, do parseMessage() and send update of game object to all clients
    socket.on('message', (message) => {
        parseMessage(message, socket.id);
        io.sockets.emit('message', JSON.stringify(game));
    });
    //When the socket has disconnected
    socket.on('disconnect', (message) => {
        if (players.length != 0) {
            io.sockets.emit('message', 'disconnected');
            //Remove the player that left
            players.splice(getPlayerIndexFromId(socket.id), 1);
            //Create a new game
            game = new Game([createPlayer(players[0].id, 0)], createRooms(), 0);
            io.sockets.emit('message', JSON.stringify(game));
        }
    });
}

//Depending on which message recieved from client, call associated function
function parseMessage(message, id) {
    var playerIndex = getPlayerIndexFromId(id);
    var data = JSON.parse(message);

    //If there are not yet two players and a client presses 'space'
    if (game.gameOn < 2 && data.data == 'space' && players[playerIndex].playing == false) {
        game.gameOn++;
        players[playerIndex].playing = true;
    } else {
        switch (data.type) {

            case 'move':
                if( game.gameOn==2){
                    movePlayer(data.data, playerIndex);
                }
                break;
            case 'action':
                action(data.data, playerIndex);
                break;
        }
    }
    console.log(players);
}

//Is triggered when the player presses any of the action-keys (in this case 'space')
function action(data, playerIndex){
    if(data=='space'){
        if (game.gameOn==2){
            pickAndDrop(playerIndex);
        } else if (game.gameOn==3 && players.length==2){
            game = new Game([createPlayer(players[0].id,0),createPlayer(players[1].id,1)], createRooms(), 0);
            players = game.players;
        }
    }
}

//Is triggered when the player presses any of the arrow keys
function movePlayer(direction, playerIndex) {
    var roomNum = players[playerIndex].inRoom;
    var room = game.layout[roomNum];
    var xpos = players[playerIndex].x;
    var ypos = players[playerIndex].y;
    var movm = 7;
    //Lets the player move closer to a wall
    while (collision(xpos, ypos, direction, movm, roomNum) && movm > 0) {
        movm--;
    }
    
    switch (direction) {
        //Checks if player is entering through a door, and if so sends them to the next room
        //If not, moves the player in the desired direction
        case 'left':
            if (room.door.open && ypos > room.door.up && ypos + 10 < room.door.down && xpos - 1 == room.left) {
                //Decrease or increase room number depending on the player
                if (playerIndex == 0) {
                    roomNum++;
                } else {
                    roomNum--;
                }
                //Move player into the other room
                xpos = game.layout[roomNum].right - 11;
            } else {
                xpos = xpos - movm;
            }
            break;
        case 'up':
            ypos = ypos - movm;
            break;
        case 'right':
            if (room.door.open && ypos > room.door.up && ypos + 10 < room.door.down && xpos + 11 == room.right) {
                if (playerIndex == 0) {
                    roomNum++;
                } else {
                    roomNum--;
                }
                xpos = game.layout[roomNum].left + 1;
            } else {
                xpos = xpos + movm;
            }
            break;
        case 'down':
            ypos = ypos + movm;
            break;
    }
    //Updates the current room and position of the player
    players[playerIndex].inRoom = roomNum;
    players[playerIndex].x = xpos;
    players[playerIndex].y = ypos;
    //When one player enters the last room, the other is also able to enter it
    //If both players have entered it, the game proceeds to being finished
    if (players[playerIndex].inRoom == 5) {
        if (players[getOtherPlayerIndex(playerIndex)].inRoom == 5) {
            game.gameOn++;
        } else {
            game.layout[4].door.open = true;
        }
    }
}

//Checks if the player is colliding with a wall in a room
function collision(xpos, ypos, direction, movm, roomNum) {

    var room = game.layout[roomNum];

    switch (direction) {
        case 'left':
            if (xpos - movm <= room.left)
                return true;
            break;
        case 'up':
            if (ypos - movm <= room.up)
                return true;
            break;
        case 'right':
            if (xpos + 10 + movm >= room.right)
                return true;
            break;
        case 'down':
            if (ypos + 10 + movm >= room.down)
                return true;
            break;
    }
    return false;
}

// Pick up an item or drop an item
function pickAndDrop(playerIndex) {
    var player = players[playerIndex];
    var room = game.layout[player.inRoom];
    var item;
    var nearItem = false;
    var itemIndex = 0;
    room.items.some(function (i) {
        if (player.x < i.x + 10 && player.x > i.x - 10 && player.y < i.y + 10 && player.y > i.y - 10) {
            nearItem = true;
            item = i;
            return true;
        }
        itemIndex++;
    });

    // Player drops an item anywhere     
    if (player.item != null && !nearItem) {
        player.item.x = player.x + 7;
        player.item.y = player.y + 7;
        //Add item to player
        room.items.push(player.item);
        player.item = null;
      // Player is standing on an item  
    } else if (nearItem) {
        // Player is standing on a movable item
        if (player.item == null) {
            if (item.shape == 'circle' || item.shape == 'triangle') {
                player.item = item;
                room.items.splice(itemIndex, 1);
            }
          // Player is standing on a drop spot  
        } else if (player.item.shape == 'circle' && item.shape == 'cspot' || player.item.shape == 'triangle' && item.shape == 'tspot') {
            player.item.x = item.x;
            player.item.y = item.y;
            room.items.push(player.item);
            player.item = null;
            // Opens door for other player
            game.layout[players[getOtherPlayerIndex(playerIndex)].inRoom].door.open = true;
        }
    }
}

function getPlayerIndexFromId(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id == id) {
            return i;
        }
    }
}
function getOtherPlayerIndex(id) {
    if (id == 0)
        return 1;
    else
        return 0;
}

//Create a new player who is either player1 or player2
function createPlayer(id, playerIndex) {
    if (playerIndex == 0) {
        return new Player(false, 55, 55, id, null, 0); //  600, 250,  4
    } else {
        return new Player(false, 650, 750, id, null, game.layout.length - 1); // 200, 380, 6
    }
}

//Reset all rooms
function createRooms(){
    return [ new Room(25, 80, 50, 90, new Door(80, 100, 55, 85, false),         [new Item("none", 0, 0)]),        // 0

            new Room(85, 300, 50, 175, new Door(300, 420, 70, 100, false),      [new Item("circle", 180, 160),    // 1
                                                                                new Item("triangle", 95, 120),
                                                                                new Item("tspot", 190, 100)]),

            new Room(420, 600, 70, 230, new Door(410, 420, 200, 230, false),    [new Item("circle", 550, 140),    // 2
                                                                                new Item("triangle", 500, 200),
                                                                                new Item("tspot", 550, 90)]),

            new Room(260, 410, 200, 300, new Door(410, 450, 245, 275, false),   [new Item("circle", 280, 230),    // 3
                                                                                new Item("triangle", 270, 280),
                                                                                new Item("cspot", 400, 285)]),

            new Room(450, 620, 240, 470, new Door(400, 450, 385, 415, false),   [new Item("circle", 510, 400),    // 4
                                                                                new Item("triangle", 550, 300),
                                                                                new Item("tspot", 600, 450)]),

            new Room(300, 400, 350, 450, new Door(0, 0, 0, 0, false),           [new Item("none", 0, 0)]),        // mitten

            new Room(40, 250, 300, 550, new Door(250, 400, 385, 415, false),    [new Item("circle", 200, 350),     //6
                                                                                new Item("triangle", 55, 530),
                                                                                new Item("cspot", 235, 490)]),

            new Room(380, 540, 500, 675, new Door(250, 380, 500, 530, false),   [new Item("circle", 395, 550),    //7
                                                                                new Item("triangle", 515, 600),
                                                                                new Item("cspot", 490, 590)]),

            new Room(25, 330, 600, 780, new Door(330, 380, 610, 640, false),    [new Item("circle", 170, 700),    //8
                                                                                new Item("triangle", 40, 770),
                                                                                new Item("tspot", 320, 770)]),

            new Room(350, 675, 700, 780, new Door(330, 380, 720, 750, false),   [new Item("circle", 360, 770),    //9
                                                                                new Item("triangle", 665, 705),
                                                                                new Item("cspot", 665, 770)])];
}








