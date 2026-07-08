let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// Controles de rotação padrão Minecraft
let yaw = new THREE.Object3D();
let pitch = new THREE.Object3D();

let gameSettings = {
    attackDelay: 0,
    speed: 400.0,
    sensitivity: 0.002
};

window.initGame = function(version) {
    if (version === "1.12.1") {
        gameSettings.attackDelay = 600;
    } else {
        gameSettings.attackDelay = 0;
    }

    // 1. Configuração da Cena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee);
    scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015); // Efeito de neblina de renderização do Minecraft

    // 2. Câmera Estilo FPS (Trava os eixos perfeitamente)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Configura a hierarquia da cabeça do jogador (Igual motores profissionais)
    pitch.add(camera);
    yaw.add(pitch);
    yaw.position.set(16, 2, 16); // Posição inicial dos olhos do jogador
    scene.add(yaw);

    // 3. Renderizador Otimizado
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Evita pixelado em telas 4k/Retina
    
    const container = document.getElementById("game-container");
    container.innerHTML = '<div id="crosshair">+</div>'; // Garante que a mira resete no centro estático
    container.appendChild(renderer.domElement);

    // 4. Iluminação Clássica
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionLight(0xffffff, 0.5);
    directionalLight.position.set(20, 40, 20);
    scene.add(directionalLight);

    // 5. Geração do Chão (32x32)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x557a2b });

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(x, 0, z);
            scene.add(cube);
        }
    }

    // 6. Pointer Lock (Trava o mouse real no centro)
    document.body.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            // Movimento horizontal gira o corpo (Giro Y)
            yaw.rotation.y -= e.movementX * gameSettings.sensitivity;
            // Movimento vertical gira a cabeça (Giro X)
            pitch.rotation.x -= e.movementY * gameSettings.sensitivity;
            
            // Trava o pescoço para não dar uma cambalhota para trás (Limite de 90 graus para cima/baixo)
            pitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.rotation.x));
        }
    });

    // Controles de Movimentação Teclado
    window.addEventListener('keydown', (e) => {
        if(e.code === 'KeyW' || e.code === 'ArrowUp') moveForward = true;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') moveBackward = true;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') moveLeft = true;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') moveRight = true;
    });

    window.addEventListener('keyup', (e) => {
        if(e.code === 'KeyW' || e.code === 'ArrowUp') moveForward = false;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') moveBackward = false;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') moveLeft = false;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') moveRight = false;
    });

    // Ajuste de Tela Sem Distorcer Gráficos
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    if (document.pointerLockElement === document.body) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // Atrito / Desaceleração estilo Minecraft (Parada suave)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Movimentação Relativa para onde o corpo (yaw) está olhando
        if (moveForward || moveBackward) velocity.z -= direction.z * gameSettings.speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * gameSettings.speed * delta;

        // Aplica os movimentos nos eixos locais Corretos
        yaw.translateX(-velocity.x * delta * 0.05);
        yaw.translateZ(velocity.z * delta * 0.05);

        prevTime = time;
    }

    renderer.render(scene, camera);
}