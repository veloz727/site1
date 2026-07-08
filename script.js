function setup() {
  createCanvas(400, 400);
}

let olhoX;
let olhoY;

function draw() {
  background('#FF5722');
  fill('blue');
  fill('#03A9F4');
  circle (200, 200, 300); //cabeça
  fill('white');
  circle (150, 150, 60);  //olho esquerdo
  circle (250, 150, 60);  //olho direito
  fill('black');
  //circle (150, 150, 10); // Pupila esquerda
  //circle (250, 150, 10); // Pupila direita
    olhoX = map(mouseX, 0, 400, 130, 170);
    olhoY = map(mouseY, 0, 400, 130, 170);
  circle(olhoX, olhoY, 10); // nova pupila esquerda
  circle(olhoX + 100, olhoY, 10); //nova pupila direita
  line(150, 270, 250, 235); //boca
  fill('#3F51B5');
  triangle(200, 180, 170, 220, 220, 220); //nariz
  line(123, 115, 178, 113); //sobrancelha direita
  line(225, 116, 279, 106); //sobrancelha esquerda
 
  
  if(mouseIsPressed) {
    console.log(mouseX, mouseY);
  }

}
