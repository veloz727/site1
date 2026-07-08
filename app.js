document.addEventListener("DOMContentLoaded", () => {
    const nicknameInput = document.getElementById("nickname");
    const versionSelect = document.getElementById("version");
    const btnJogar = document.getElementById("btn-jogar");
    const launcher = document.getElementById("launcher");
    const loadingScreen = document.getElementById("loading-screen");
    const gameContainer = document.getElementById("game-container");

    if (localStorage.getItem("webcraft_nick")) {
        nicknameInput.value = localStorage.getItem("webcraft_nick");
    }

    btnJogar.addEventListener("click", () => {
        const nickname = nicknameInput.value.trim();
        const versaoSelecionada = versionSelect.value;

        if (nickname === "") return;

        localStorage.setItem("webcraft_nick", nickname);

        launcher.classList.add("hidden");
        loadingScreen.classList.remove("hidden");

        setTimeout(() => {
            loadingScreen.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            
            if (typeof window.initGame === "function") {
                window.initGame(versaoSelecionada);
            }
        }, 2000);
    });
});