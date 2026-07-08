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
    speed: 400.0,
    sensitivity: 0.002,
    kbHorizontal: 1.5,
    kbVertical: 0.3,
    jumpStrength: 15.0,
    gravity: 9.8 * 4,
    renderDistance: 3,
    chunkSize: 16,
    worldBorder: 500000,
    blockBreakTime: 1000 
};

let playerStats = {
    health: 20,
    food: 20,
    isBlocking: false,
    canJump: true
};

let clicksThisSecond = 0;
let currentCPS = 0;
let lastCPSCheck = performance.now();
let lastCommandTime = 0;
let bypassCommands = ["/spawn", "/report", "/ajuda"];
let savedInventory = null;

let materials = [];
let logMaterial, leavesMaterial;
let geometry = new THREE.BoxGeometry(1, 1, 1);
let loadedChunks = new Map();
let seed = Math.random();

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(0, 0);
let breakingBlock = null;
let breakStartTime = 0;

let hotbar = ["grass", "dirt", "wood", "leaves", "", "", "", "", ""];
let selectedSlot = 0;

window.initGame = function(version) {
    if (version === "1.12.1") {
        gameSettings.attackDelay = 600;
    } else if (version === "1.8.9") {
        gameSettings.attackDelay = 0;
    } else {
        gameSettings.attackDelay = 0;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee);
    scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    pitch.add(camera);
    yaw.add(pitch);
    yaw.position.set(8, 15, 8);
    scene.add(yaw);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    setupHUD();
    
    const container = document.getElementById("game-container");
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.45);
    directionalLight.position.set(20, 40, 20);
    scene.add(directionalLight);

    const textureLoader = new THREE.TextureLoader();
    
    const textureTop = textureLoader.load('assets/grass_top.png');    
    const textureSide = textureLoader.load('assets/grass_side.png');   
    const textureBottom = textureLoader.load('assets/dirt.png'); 

    [textureTop, textureSide, textureBottom].forEach(tex => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
    });

    materials = [
        new THREE.MeshLambertMaterial({ map: textureSide }),   
        new THREE.MeshLambertMaterial({ map: textureSide }),   
        new THREE.MeshLambertMaterial({ map: textureTop, color: 0x5b8731 }), 
        new THREE.MeshLambertMaterial({ map: textureBottom }), 
        new THREE.MeshLambertMaterial({ map: textureSide }),   
        new THREE.MeshLambertMaterial({ map: textureSide })    
    ];

    logMaterial = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x3b5e2b });

    updateChunks();

    document.body.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
            return;
        }
        if (e.button === 0) {
            startBreakingBlock();
        }
    });

    document.body.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            stopBreakingBlock();
        }
    });

    document.body.addEventListener('contextmenu', (e) => {
        e.preventDefault();
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
        if(e.code === 'Space') moveUp = true;
        
        if(e.key >= 1 && e.key <= 9) {
            selectedSlot = parseInt(e.key) - 1;
            updateHotbarUI();
        }
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

function setupHUD() {
    const container = document.getElementById("game-container");
    container.innerHTML = `
        <div id="crosshair">+</div>
        <div id="hud-container" style="position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; width: 360px; margin-bottom: 5px;">
                <div id="health-bar" style="color: #ff2222; font-weight: bold; font-size: 18px;">❤❤❤❤❤❤❤❤❤❤</div>
                <div id="food-bar" style="color: #ffaa00; font-weight: bold; font-size: 18px;">🍗🍗🍗🍗🍗🍗🍗🍗🍗🍗</div>
            </div>
            <div id="hotbar" style="display: flex; background: rgba(0,0,0,0.6); padding: 4px; border: 4px solid #333; border-radius: 4px;">
                ${hotbar.map((item, idx) => `<div id="slot-${idx}" style="width: 36px; height: 36px; margin: 0 2px; border: 2px solid #888; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; background: #555;">${item}</div>`).join('')}
            </div>
            <div id="break-progress" style="width: 200px; height: 10px; border: 1px solid white; margin-top: 10px; display: none; background: rgba(0,0,0,0.5);">
                <div id="break-bar" style="width: 0%; height: 100%; background: yellow;"></div>
            </div>
        </div>
    `;
    updateHotbarUI();
}

function updateHotbarUI() {
    for(let i=0; i<9; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if(slot) {
            slot.style.borderColor = (i === selectedSlot) ? "#fff" : "#888";
            slot.style.background = (i === selectedSlot) ? "#777" : "#555";
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
    if (playerStats.food > 0) {
        playerStats.food--;
    } else {
        playerStats.health = Math.max(0, playerStats.health - 1);
    }
    updateHUDStatus();
}

function startBreakingBlock() {
    raycaster.setFromCamera(mouse, camera);
    let allObjects = [];
    loadedChunks.forEach(chunk => allObjects.push(...chunk.children));
    
    let intersects = raycaster.intersectObjects(allObjects);
    if (intersects.length > 0 && intersects[0].distance < 5) {
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
    let allObjects = [];
    loadedChunks.forEach(chunk => allObjects.push(...chunk.children));
    let intersects = raycaster.intersectObjects(allObjects);

    if (intersects.length > 0 && intersects[0].object === breakingBlock && intersects[0].distance < 5) {
        let elapsed = performance.now() - breakStartTime;
        let pct = Math.min(100, (elapsed / gameSettings.blockBreakTime) * 100);
        document.getElementById("break-bar").style.style.width = pct + "%";

        if (elapsed >= gameSettings.blockBreakTime) {
            let parentChunk = breakingBlock.parent;
            if (parentChunk) parentChunk.remove(breakingBlock);
            stopBreakingBlock();
            
            if(Math.random() < 0.2) {
                playerStats.health = Math.max(0, playerStats.health - 2);
                updateHUDStatus();
            }
        }
    } else {
        stopBreakingBlock();
    }
}

function pseudoRandomNoise(x, z) {
    let nx = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453123;
    return (nx - Math.floor(nx));
}

function getTerrainHeight(x, z) {
    let noise1 = pseudoRandomNoise(Math.floor(x * 0.05), Math.floor(z * 0.05)) * 12;
    let noise2 = pseudoRandomNoise(Math.floor(x * 0.1), Math.floor(z * 0.1)) * 4;
    return Math.floor(noise1 + noise2);
}

function generateChunk(chunkX, chunkZ) {
    let chunkKey = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(chunkKey)) return;

    let chunkGroup = new THREE.Group();
    let sz = gameSettings.chunkSize;

    for (let x = 0; x < sz; x++) {
        for (let z = 0; z < sz; z++) {
            let worldX = chunkX * sz + x;
            let worldZ = chunkZ * sz + z;

            if (Math.abs(worldX) > gameSettings.worldBorder || Math.abs(worldZ) > gameSettings.worldBorder) {
                continue;
            }

            let height = getTerrainHeight(worldX, worldZ);

            for (let y = 0; y <= height + 4; y++) {
                let currentMaterials = materials;
                if (y < height + 4) {
                    currentMaterials = [materials[3], materials[3], materials[3], materials[3], materials[3], materials[3]];
                }
                const cube = new THREE.Mesh(geometry, currentMaterials);
                cube.position.set(worldX, y, worldZ);
                chunkGroup.add(cube);
            }

            if (pseudoRandomNoise(worldX, worldZ) > 0.98 && worldX % 4 === 0) {
                let baseHeight = height + 5;
                for (let ty = 0; ty < 4; ty++) {
                    const log = new THREE.Mesh(geometry, logMaterial);
                    log.position.set(worldX, baseHeight + ty, worldZ);
                    chunkGroup.add(log);
                }
                for (let lx = -1; lx <= 1; lx++) {
                    for (let lz = -1; lz <= 1; lz++) {
                        for (let ly = 2; ly <= 4; ly++) {
                            if(lx === 0 && lz === 0 && ly === 2) continue;
                            const leaf = new THREE.Mesh(geometry, leavesMaterial);
                            leaf.position.set(worldX + lx, baseHeight + ly, worldZ + lz);
                            chunkGroup.add(leaf);
                        }
                    }
                }
            }
        }
    }

    scene.add(chunkGroup);
    loadedChunks.set(chunkKey, chunkGroup);
}

function updateChunks() {
    let playerChunkX = Math.floor(yaw.position.x / gameSettings.chunkSize);
    let playerChunkZ = Math.floor(yaw.position.z / gameSettings.chunkSize);
    let r = gameSettings.renderDistance;

    for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
            generateChunk(playerChunkX + x, playerChunkZ + z);
        }
    }

    for (let [key, value] of loadedChunks.entries()) {
        let [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - playerChunkX) > r + 1 || Math.abs(cz - playerChunkZ) > r + 1) {
            scene.remove(value);
            loadedChunks.delete(key);
        }
    }
}

function handleLeftClick() {
    clicksThisSecond++;
    let isSprinting = (moveForward && velocity.z < -50);
    let isCritical = (velocity.y < 0 && yaw.position.y > 2);
    let currentDamage = 5;

    if (playerStats.isBlocking) currentDamage *= 0.5;
    if (isCritical) currentDamage *= 1.5;
    if (isSprinting) {
        let pushHorizontal = gameSettings.kbHorizontal;
        let pushVertical = gameSettings.kbVertical;
    }
}

window.executeGameCommand = function(cmdString) {
    let baseCmd = cmdString.toLowerCase().split(" ")[0];
    if (bypassCommands.includes(baseCmd)) {
        processCommandLogic(cmdString);
        return;
    }
    let now = performance.now();
    if (now - lastCommandTime < 3000) return;
    lastCommandTime = now;
    processCommandLogic(cmdString);
}

function processCommandLogic(cmdString) {
    let args = cmdString.split(" ");
    let baseCmd = args[0].toLowerCase();

    if (baseCmd === "/verinv") {
        let currentStatus = { health: playerStats.health, food: playerStats.food };
    } else if (baseCmd === "/clearinv") {
        if (args[1] === "undo") {
            if (savedInventory) savedInventory = null;
        } else {
            savedInventory = true;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    let time = performance.now();

    if (time - lastCPSCheck >= 1000) {
        currentCPS = clicksThisSecond;
        if (currentCPS > 18) {
            console.warn("CPS Alto Detectado: " + currentCPS);
        }
        clicksThisSecond = 0;
        lastCPSCheck = time;
    }

    checkBlockBreaking();

    if (document.pointerLockElement === document.body) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
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

        yaw.translateX(-velocity.x * delta * 0.05);
        yaw.translateZ(velocity.z * delta * 0.05);
        yaw.position.y += velocity.y * delta;

        let border = gameSettings.worldBorder;
        if (yaw.position.x > border) yaw.position.x = border;
        if (yaw.position.x < -border) yaw.position.x = -border;
        if (yaw.position.z > border) yaw.position.z = border;
        if (yaw.position.z < -border) yaw.position.z = -border;

        let currentHeight = getTerrainHeight(yaw.position.x, yaw.position.z) + 5.5;
        if (yaw.position.y < currentHeight) {
            velocity.y = 0;
            yaw.position.y = currentHeight;
            playerStats.canJump = true;
        }

        updateChunks();

        prevTime = time;
    }

    renderer.render(scene, camera);
}