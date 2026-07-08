let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// Configurações de jogabilidade baseadas na versão
let gameSettings = {
    attackDelay: 0,
    speed: 400.0
};

function initGame(version) {
    // Ajusta mecânicas com base na versão escolhida no Launcher
    if (version === "1.12.1") {
        gameSettings.attackDelay = 600; // Delay de ataque em milissegundos
        console.log("Mecânicas da 1.12.1 ativadas: Delay de ataque configurado.");
    } else {
        gameSettings.attackDelay = 0; // Combate rápido da 1.8.9
        console.log("Mecânicas da 1.8.9 ativadas: Combate rápido sem cooldown.");
    }

    // 1. Criar a Cena e Câmera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee); // Cor do céu (Skyblue)
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(16, 2, 16); // Posição inicial do jogador

    // 2. Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById("game-container").appendChild(renderer.domElement);

    // 3. Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);

    // 4. Gerar Mundo Simples (Mundo plano de 32x32 blocos de grama)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x557a2b }); // Verde Grama

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(x, 0, z);
            scene.add(cube);
        }
    }

    // 5. Controles Pointer Lock (Ativa ao clicar na tela do jogo)
    document.body.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            camera.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;
            // Limita a rotação vertical para não dar "looping" na cabeça
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        }
    });

    // Inputs de Teclado
    window.addEventListener('keydown', (e) => {
        if(e.code === 'KeyW') moveForward = true;
        if(e.code === 'KeyS') moveBackward = true;
        if(e.code === 'KeyA') moveLeft = true;
        if(e.code === 'KeyD') moveRight = true;
    });

    window.addEventListener('keyup', (e) => {
        if(e.code === 'KeyW') moveForward = false;
        if(e.code === 'KeyS') moveBackward = false;
        if(e.code === 'KeyA') moveLeft = false;
        if(e.code === 'KeyD') moveRight = false;
    });

    // Ajuste de Janela Dinâmico
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Iniciar o Loop de Renderização/Física
    animate();
}

// Loop de Animação e Movimento
function animate() {
    requestAnimationFrame(animate);

    if (document.pointerLockElement === document.body) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // Reduz a velocidade gradativamente (atrito)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Aplica o movimento na direção que a câmera está olhando
        const camDirection = new THREE.Vector3();
        camera.getWorldDirection(camDirection);
        camDirection.y = 0; // Previne voar/afundar ao olhar para cima/baixo
        camDirection.normalize();

        const camSideways = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        if (moveForward || moveBackward) {
            velocity.z -= direction.z * gameSettings.speed * delta;
        }
        if (moveLeft || moveRight) {
            velocity.x -= direction.x * gameSettings.speed * delta;
        }

        // Atualiza a posição da câmera
        camera.position.addScaledVector(camDirection, -velocity.z * delta * 0.05);
        camera.position.addScaledVector(camSideways, velocity.x * delta * 0.05);

        prevTime = time;
    }

    renderer.render(scene, camera);
}