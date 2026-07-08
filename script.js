const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec0ee);
scene.fog = new THREE.FogExp2(0x7ec0ee, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(20, 40, 20);
scene.add(directionalLight);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const materialGrama = new THREE.MeshLambertMaterial({ color: 0x557a2b });

const blocks = [];
const worldSize = 20;

for (let x = -worldSize/2; x < worldSize/2; x++) {
    for (let z = -worldSize/2; z < worldSize/2; z++) {
        let y = Math.floor(Math.sin(x * 0.2) * 2 + Math.cos(z * 0.2) * 2);
        
        for (let h = -3; h <= y; h++) {
            const block = new THREE.Mesh(geometry, materialGrama);
            block.position.set(x, h, z);
            scene.add(block);
            blocks.push(block);
        }
    }
}

camera.position.set(0, 5, 0);
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let canJump = false;
let prevTime = performance.now();

document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});

let yaw = 0;
let pitch = 0;

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        yaw -= event.movementX * 0.002;
        pitch -= event.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch));

        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
});

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': if (canJump) velocity.y += 8; canJump = false; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(blocks);

    if (intersects.length > 0 && intersects[0].distance < 6) {
        const intersect = intersects[0];

        if (e.button === 0) {
            scene.remove(intersect.object);
            blocks.splice(blocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) {
            const position = new THREE.Vector3().copy(intersect.point).add(intersect.face.normal);
            position.x = Math.round(position.x);
            position.y = Math.round(position.y);
            position.z = Math.round(position.z);

            const newBlock = new THREE.Mesh(geometry, materialGrama);
            newBlock.position.copy(position);
            scene.add(newBlock);
            blocks.push(newBlock);
        }
    }
});

document.addEventListener('contextmenu', e => e.preventDefault());

function animate() {
    requestAnimationFrame(animate);

    if (document.pointerLockElement === document.body) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 2.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const camDirection = new THREE.Vector3();
        camera.getWorldDirection(camDirection);
        camDirection.y = 0;
        camDirection.normalize();

        const camSide = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        if (moveForward || moveBackward) {
            velocity.addScaledVector(camDirection, direction.z * 40.0 * delta);
        }
        if (moveLeft || moveRight) {
            velocity.addScaledVector(camSide, direction.x * 40.0 * delta);
        }

        camera.position.addScaledVector(velocity, delta);

        if (camera.position.y < 2) {
            velocity.y = 0;
            camera.position.y = 2;
            canJump = true;
        }

        prevTime = time;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();