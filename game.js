let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

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

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee);
    scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    pitch.add(camera);
    yaw.add(pitch);
    yaw.position.set(16, 2, 16);
    scene.add(yaw);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const container = document.getElementById("game-container");
    container.innerHTML = '<div id="crosshair">+</div>';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // LINHA CORRIGIDA: DirectionalLight
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(20, 40, 20);
    scene.add(directionalLight);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x557a2b });

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(x, 0, z);
            scene.add(cube);
        }
    }

    document.body.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            yaw.rotation.y -= e.movementX * gameSettings.sensitivity;
            pitch.rotation.x -= e.movementY * gameSettings.sensitivity;
            pitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.rotation.x));
        }
    });

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

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * gameSettings.speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * gameSettings.speed * delta;

        yaw.translateX(-velocity.x * delta * 0.05);
        yaw.translateZ(velocity.z * delta * 0.05);

        prevTime = time;
    }

    renderer.render(scene, camera);
}