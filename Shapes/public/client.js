window.onload = init;

var socket;

function init() {
    //When key is pressed, execute keyPress function
    document.body.onkeydown = keyPress;
}

function setup(){
    createCanvas(700,800);
    //Connect to the server socket
    socket = io.connect('http://localhost:3010');
    console.log('Connected to server');
    //Recieve updates from server
    socket.on('message', handleMessage);
}

var gameOn = 0;
var game;
var rooms;
var players = new Array();
var disconnection = false;
var tooMany = false;

//Handle message from server
function handleMessage(message){
    switch (message){
        case 'disconnected':
            disconnection = true;
            break;
        case 'tooMany':
            tooMany = true;
            break;
        default:
        //Parse message from JSON string to object
            game = JSON.parse(message);
            gameOn = game.gameOn;
            rooms = game.layout;
            players = game.players;
            break;
    }    
}

function draw(){   
    //Set background color
    background(0);
    //Set text color, size and font
    fill(255);
    textFont('Courier');
    if(tooMany){
        textSize(20);
        text('Sorry, there are already two playing the game', 90, 400);
    }
    else if(disconnection){
        textSize(20);
        text('The other player has left the game...', 120, 400);
        setTimeout(() => {
            disconnection = false;
        }, 5000);
        
    } else{
        //Start screen
        if(gameOn < 2){  
            drawStartPage();
        } else if(gameOn==2){
            //Draw gameplay screen
            textSize(15);
            text('Press space to pick up/drop an object',10,20);
            var door;
            rooms.forEach(function(room){
                strokeWeight(0);
                door = room.door;
                fill(52);
                rect(room.left,room.up,room.right-room.left,room.down-room.up);     
                if (door.open == true) {
                    rect(door.left,door.up,door.right-door.left,door.down-door.up)
                }         
                strokeWeight(1);
                //Draw the rooms
                room.items.forEach(function(item){

                    switch(item.shape) {
                    case "circle": 
                        fill(165,104,220);
                        ellipse(item.x,item.y,14,14);
                        break;
                    case "triangle":
                        fill(138,195,118);
                        triangle(item.x-7,item.y+7,item.x,item.y-7,item.x+7,item.y+7);
                        break;
                    case "cspot":
                        fill(0);
                        stroke(100);
                        ellipse(item.x,item.y,14,14);
                        break;
                    case "tspot":
                        fill(0);
                        stroke(100);
                        triangle(item.x-7,item.y+7,item.x,item.y-7,item.x+7,item.y+7);
                        break;
                    case "none":
                        break;
                    }
                    stroke(0);
                    });
                });       
                drawPlayer(0,223,67,98);
                drawPlayer(1,34,122,199);
        } else if(gameOn==3){
            drawFinnished();
        }
    }   
}

function drawPlayer(playerIndex,r,g,b){
    fill(r,g,b);
    rect(players[playerIndex].x, players[playerIndex].y, 10, 10);
}

function drawFinnished(){
    //Finished game screen
    textSize(40);
    fill(255);
    text('You have won!!!', 170, 400);
    textSize(30);
    text('Press space to play again..', 130, 500);
}

function drawStartPage(){
    fill(138,195,118);
    textSize(40);
    text('Welcome to', 210, 150);
    textSize(90);
    fill(165,104,220);
    text('SHAPES', 170, 250);
    fill(255);
    textSize(40);
    text('Press space to start!', 90, 400);
}

//Send player input to server 
function keyPress(event){

    var message = {
        type: 'move',
        data: ''
    }
    //Update data variable depending on which key is pressed
    switch(event.keyCode) {
        //Space
        case 32:
            message.type = 'action';
            message.data = 'space';
            break;
        //Left arrow
        case 37:
            message.data = 'left';
            break;
        //Up arrow
        case 38:
            message.data = 'up';
            break;
        //Right arrow
        case 39:
            message.data = 'right';
            break;
        //Down arrow
        case 40:
            message.data = 'down';
            break;
    }
    //Send message to server socket, convert object to JSON string
    socket.emit('message', JSON.stringify(message));
}
