let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let moveUp = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

let yaw = new THREE.Object3D();
let pitch = new THREE.Object3D();

let gameSettings = {
    attackDelay: 0,
    speed: 380.0,
    sensitivity: 0.0022,
    kbHorizontal: 1.4,
    kbVertical: 0.32,
    jumpStrength: 12.5,
    gravity: 38.0,
    renderDistance: 3,
    chunkSize: 16,
    worldBorder: 500000,
    blockBreakTime: 800
};

let playerStats = {
    health: 20,
    food: 20,
    isBlocking: false,
    canJump: true,
    height: 1.8,
    radius: 0.3
};

let clicksThisSecond = 0;
let currentCPS = 0;
let lastCPSCheck = performance.now();
let lastCommandTime = 0;
let bypassCommands = ["/spawn", "/report", "/ajuda"];
let savedInventory = null;

let materials = {};
let loadedChunks = new Map();
let worldBlocks = new Map();
let seed = Math.random();

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(0, 0);
let breakingBlock = null;
let breakStartTime = 0;

let hotbar = ["grass", "dirt", "wood", "leaves", "", "", "", "", ""];
let selectedSlot = 0;

window.initGame = function(version) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee);
    scene.fog = new THREE.FogExp2(0x7ec0ee, 0.02);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);
    
    pitch.add(camera);
    yaw.add(pitch);
    yaw.position.set(8, 25, 8);
    scene.add(yaw);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    
    setupHUD();
    
    const container = document.getElementById("game-container");
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.80);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.40);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    const textureLoader = new THREE.TextureLoader();
    const tTop = textureLoader.load('assets/grass_top.png');    
    const tSide = textureLoader.load('assets/grass_side.png');   
    const tBottom = textureLoader.load('assets/dirt.png'); 

    [tTop, tSide, tBottom].forEach(tex => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
    });

    materials.grass = [
        new THREE.MeshLambertMaterial({ map: tSide }), new THREE.MeshLambertMaterial({ map: tSide }),
        new THREE.MeshLambertMaterial({ map: tTop, color: 0x5b8731 }), new THREE.MeshLambertMaterial({ map: tBottom }),
        new THREE.MeshLambertMaterial({ map: tSide }), new THREE.MeshLambertMaterial({ map: tSide })
    ];
    materials.dirt = new THREE.MeshLambertMaterial({ map: tBottom });
    materials.wood = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    materials.leaves = new THREE.MeshLambertMaterial({ color: 0x3b5e2b, transparent: true, opacity: 0.9 });

    updateChunks();

    document.body.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
            return;
        }
        if (e.button === 0) startBreakingBlock();
    });

    document.body.addEventListener('mouseup', (e) => {
        if (e.button === 0) stopBreakingBlock();
    });

    document.body.addEventListener('contextmenu', e => e.preventDefault());

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
        if(e.code === 'Space') moveUp = true;
        if(e.key >= 1 && e.key <= 9) { selectedSlot = parseInt(e.key) - 1; updateHotbarUI(); }
    });

    window.addEventListener('keyup', (e) => {
        if(e.code === 'KeyW' || e.code === 'ArrowUp') moveForward = false;
        if(e.code === 'KeyS' || e.code === 'ArrowDown') moveBackward = false;
        if(e.code === 'KeyA' || e.code === 'ArrowLeft') moveLeft = false;
        if(e.code === 'KeyD' || e.code === 'ArrowRight') moveRight = false;
        if(e.code === 'Space') moveUp = false;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    setInterval(simulateSurvival, 4000);
    animate();
}

function pseudoRandomNoise(x, z) {
    let nx = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453123;
    return (nx - Math.floor(nx));
}

function getTerrainHeight(x, z) {
    let noise1 = pseudoRandomNoise(Math.floor(x * 0.04), Math.floor(z * 0.04)) * 14;
    let noise2 = pseudoRandomNoise(Math.floor(x * 0.08), Math.floor(z * 0.08)) * 5;
    return Math.floor(noise1 + noise2) + 4;
}

function getBlockAt(x, y, z) {
    return worldBlocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || null;
}

function setBlockAt(x, y, z, type) {
    let key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (type === null) worldBlocks.delete(key);
    else worldBlocks.set(key, type);
}

function generateChunkData(chunkX, chunkZ) {
    let sz = gameSettings.chunkSize;
    for (let x = 0; x < sz; x++) {
        for (let z = 0; z < sz; z++) {
            let worldX = chunkX * sz + x;
            let worldZ = chunkZ * sz + z;
            let height = getTerrainHeight(worldX, worldZ);

            for (let y = 0; y <= height; y++) {
                let type = (y === height) ? "grass" : "dirt";
                setBlockAt(worldX, y, worldZ, type);
            }

            if (pseudoRandomNoise(worldX, worldZ) > 0.975 && worldX % 3 === 0) {
                let baseHeight = height + 1;
                for (let ty = 0; ty < 5; ty++) setBlockAt(worldX, baseHeight + ty, worldZ, "wood");
                for (let lx = -2; lx <= 2; lx++) {
                    for (let lz = -2; lz <= 2; lz++) {
                        for (let ly = 3; ly <= 5; ly++) {
                            if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                            let bx = worldX + lx, by = baseHeight + ly, bz = worldZ + lz;
                            if (!getBlockAt(bx, by, bz)) setBlockAt(bx, by, bz, "leaves");
                        }
                    }
                }
            }
        }
    }
}

function buildChunkMesh(chunkX, chunkZ) {
    let chunkGroup = new THREE.Group();
    let sz = gameSettings.chunkSize;
    let geo = new THREE.BoxGeometry(1, 1, 1);

    for (let x = 0; x < sz; x++) {
        for (let z = 0; z < sz; z++) {
            let worldX = chunkX * sz + x;
            let worldZ = chunkZ * sz + z;
            let height = getTerrainHeight(worldX, worldZ) + 6;

            for (let y = 0; y <= height; y++) {
                let type = getBlockAt(worldX, y, worldZ);
                if (!type) continue;

                let mat = (type === "grass") ? materials.grass : materials[type];
                let mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(worldX, y, worldZ);
                mesh.userData = { x: worldX, y: y, z: worldZ };
                chunkGroup.add(mesh);
            }
        }
    }
    return chunkGroup;
}

function updateChunks() {
    let pX = Math.floor(yaw.position.x / gameSettings.chunkSize);
    let pZ = Math.floor(yaw.position.z / gameSettings.chunkSize);
    let r = gameSettings.renderDistance;

    for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
            let cx = pX + x, cz = pZ + z;
            let key = `${cx},${cz}`;
            if (!loadedChunks.has(key)) {
                generateChunkData(cx, cz);
                let mesh = buildChunkMesh(cx, cz);
                scene.add(mesh);
                loadedChunks.set(key, mesh);
            }
        }
    }

    for (let [key, value] of loadedChunks.entries()) {
        let [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - pX) > r + 1 || Math.abs(cz - pZ) > r + 1) {
            scene.remove(value);
            loadedChunks.delete(key);
        }
    }
}

function startBreakingBlock() {
    raycaster.setFromCamera(mouse, camera);
    let meshes = [];
    loadedChunks.forEach(c => meshes.push(...c.children));
    let intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0 && intersects[0].distance < 4.5) {
        breakingBlock = intersects[0].object;
        breakStartTime = performance.now();
        document.getElementById("break-progress").style.display = "block";
    }
}

function stopBreakingBlock() {
    breakingBlock = null;
    document.getElementById("break-progress").style.display = "none";
}

function checkBlockBreaking() {
    if (!breakingBlock) return;
    raycaster.setFromCamera(mouse, camera);
    let meshes = [];
    loadedChunks.forEach(c => meshes.push(...c.children));
    let intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0 && intersects[0].object === breakingBlock && intersects[0].distance < 4.5) {
        let elapsed = performance.now() - breakStartTime;
        let pct = Math.min(100, (elapsed / gameSettings.blockBreakTime) * 100);
        document.getElementById("break-bar").style.width = pct + "%";

        if (elapsed >= gameSettings.blockBreakTime) {
            let bData = breakingBlock.userData;
            setBlockAt(bData.x, bData.y, bData.z, null);
            breakingBlock.parent.remove(breakingBlock);
            stopBreakingBlock();
        }
    } else {
        stopBreakingBlock();
    }
}

function checkCollisions(pos, vel, delta) {
    let nextPos = pos.clone().add(vel.clone().multiplyScalar(delta * 0.05));
    
    let footY = Math.floor(nextPos.y - playerStats.height);
    let headY = Math.floor(nextPos.y);
    let blockBelow = getBlockAt(nextPos.x, footY, nextPos.z);
    
    if (blockBelow) {
        if (vel.y < 0) {
            vel.y = 0;
            pos.y = footY + playerStats.height + 1;
            playerStats.canJump = true;
        }
    } else {
        pos.y = nextPos.y;
    }

    let checkBlockX = getBlockAt(nextPos.x + (vel.x > 0 ? playerStats.radius : -playerStats.radius), Math.floor(pos.y - 1), pos.z);
    if (!checkBlockX) pos.x = nextPos.x;
    else vel.x = 0;

    let checkBlockZ = getBlockAt(pos.x, Math.floor(pos.y - 1), nextPos.z + (vel.z > 0 ? playerStats.radius : -playerStats.radius));
    if (!checkBlockZ) pos.z = nextPos.z;
    else vel.z = 0;
}

function setupHUD() {
    const container = document.getElementById("game-container");
    container.innerHTML = `
        <div id="crosshair">+</div>
        <div id="hud-container" style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; font-family: monospace; image-rendering: pixelated;">
            <div style="display: flex; justify-content: space-between; width: 320px; margin-bottom: 8px;">
                <div id="health-bar" style="color: #ff3333; font-size: 20px; letter-spacing: 2px;">❤❤❤❤❤❤❤❤❤❤</div>
                <div id="food-bar" style="color: #ffaa00; font-size: 20px; letter-spacing: 2px;">🍗🍗🍗🍗🍗🍗🍗🍗🍗🍗</div>
            </div>
            <div id="hotbar" style="display: flex; background: rgba(30,30,30,0.85); padding: 5px; border: 4px solid #4a4a4a; border-radius: 2px;">
                ${hotbar.map((item, idx) => `<div id="slot-${idx}" style="width: 38px; height: 38px; margin: 0 3px; border: 3px solid #777; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 9px; font-weight: bold; background: #2e2e2e;">${item.toUpperCase()}</div>`).join('')}
            </div>
            <div id="break-progress" style="width: 160px; height: 8px; border: 2px solid #fff; margin-top: 12px; display: none; background: rgba(0,0,0,0.6);">
                <div id="break-bar" style="width: 0%; height: 100%; background: #ffff00;"></div>
            </div>
        </div>
    `;
    updateHotbarUI();
}

function updateHotbarUI() {
    for(let i=0; i<9; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if(slot) {
            slot.style.borderColor = (i === selectedSlot) ? "#ffffff" : "#777777";
            slot.style.background = (i === selectedSlot) ? "#5c5c5c" : "#2e2e2e";
        }
    }
}

function updateHUDStatus() {
    const hBar = document.getElementById("health-bar");
    const fBar = document.getElementById("food-bar");
    if(hBar) hBar.innerText = "❤".repeat(Math.max(0, Math.ceil(playerStats.health / 2)));
    if(fBar) fBar.innerText = "🍗".repeat(Math.max(0, Math.ceil(playerStats.food / 2)));
}

function simulateSurvival() {
    if (playerStats.food > 0) playerStats.food--;
    else playerStats.health = Math.max(0, playerStats.health - 1);
    updateHUDStatus();
}

function animate() {
    requestAnimationFrame(animate);
    let time = performance.now();

    checkBlockBreaking();

    if (document.pointerLockElement === document.body) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 12.0 * delta;
        velocity.z -= velocity.z * 12.0 * delta;
        velocity.y -= gameSettings.gravity * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * gameSettings.speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * gameSettings.speed * delta;

        if (moveUp && playerStats.canJump) {
            velocity.y = gameSettings.jumpStrength;
            playerStats.canJump = false;
        }

        checkCollisions(yaw.position, velocity, delta);
        updateChunks();
        prevTime = time;
    }

    renderer.render(scene, camera);
}