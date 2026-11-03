// ============================================================================
// TA5MENA (TOP 10) - APPLICATION LOGIC & REALTIME ENGINE
// Real-time online multiplayer party game with 3-Layer Verification Engine.
// Supports Firebase Realtime Database (v10+ modular SDK) with zero external server.
// ============================================================================

import { 
  SUGGESTIONS, 
  normalizeText, 
  getLevenshteinDistance, 
  searchSuggestions 
} from "./suggestions.js";

// ============================================================================
// FIREBASE CONFIGURATION
// Realtime Database modular SDK configuration
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyAB-4u21RACQ7spsVNqV6WtJCD2F9tVl5Y",
  authDomain: "ta5mena.firebaseapp.com",
  databaseURL: "https://ta5mena-default-rtdb.firebaseio.com",
  projectId: "ta5mena",
  storageBucket: "ta5mena.firebasestorage.app",
  messagingSenderId: "1076977607984",
  appId: "1:1076977607984:web:af4a66230cdde9701394f5"
};

// ============================================================================
// DATABASE ADAPTER: FIREBASE + MULTI-TAB LOCAL FALLBACK
// Automatically connects to Firebase Realtime Database on load.
// ============================================================================

class DatabaseService {
  constructor() {
    this.isFirebaseReady = false;
    this.fbDb = null;
    this.listeners = new Map();
    this.broadcastChannel = null;

    // Hardcoded firebaseConfig is the sole connection configuration
    this.activeConfig = firebaseConfig;
    this.initPromise = this.initDatabase();
  }

  async initDatabase() {
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { getDatabase } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      
      const app = getApps().length === 0 ? initializeApp(this.activeConfig) : getApp();
      this.fbDb = getDatabase(app);
      this.isFirebaseReady = true;
      console.log("[Ta5mena] Connected to Firebase Realtime Database:", this.activeConfig.databaseURL);
    } catch (err) {
      console.warn("[Ta5mena] Firebase initialization error. Falling back to local multi-tab sync:", err);
      this.setupLocalFallback();
    }
  }

  setupLocalFallback() {
    this.isFirebaseReady = false;
    if (window.BroadcastChannel) {
      this.broadcastChannel = new BroadcastChannel("ta5mena_sync_channel");
      this.broadcastChannel.onmessage = (event) => {
        const { path, data } = event.data;
        this.triggerLocalListeners(path, data);
      };
    }
  }

  async trackPlayerConnection(roomCode, playerId) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, onValue, onDisconnect, set } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        if (this.disconnectUnsub) {
          this.disconnectUnsub();
          this.disconnectUnsub = null;
        }

        const connectedRef = ref(this.fbDb, ".info/connected");
        const playerConnectedRef = ref(this.fbDb, `rooms/${roomCode}/players/${playerId}/connected`);

        this.disconnectUnsub = onValue(connectedRef, async (snap) => {
          if (snap.val() === true) {
            await onDisconnect(playerConnectedRef).set(false);
            await set(playerConnectedRef, true);
          }
        });
      } catch (err) {
        console.warn("[Ta5mena] Connection tracking error:", err);
      }
    } else {
      this.set(`rooms/${roomCode}/players/${playerId}/connected`, true);
    }
  }

  async setPlayerConnected(roomCode, playerId, isConnected) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, set } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        return set(ref(this.fbDb, `rooms/${roomCode}/players/${playerId}/connected`), isConnected);
      } catch (err) {}
    } else {
      return this.set(`rooms/${roomCode}/players/${playerId}/connected`, isConnected);
    }
  }

  async stopPlayerConnectionTracking(roomCode, playerId) {
    if (this.disconnectUnsub) {
      this.disconnectUnsub();
      this.disconnectUnsub = null;
    }
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, onDisconnect } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        const playerConnectedRef = ref(this.fbDb, `rooms/${roomCode}/players/${playerId}/connected`);
        await onDisconnect(playerConnectedRef).cancel();
      } catch (err) {}
    }
  }

  async set(path, data) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      const { ref, set } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      return set(ref(this.fbDb, path), data);
    } else {
      if (data === null) {
        return this.remove(path);
      }
      localStorage.setItem("db_" + path, JSON.stringify(data));
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ path, data });
      }
      this.triggerLocalListeners(path, data);
      return Promise.resolve();
    }
  }

  async remove(path) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      const { ref, remove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      return remove(ref(this.fbDb, path));
    } else {
      localStorage.removeItem("db_" + path);
      // Clean up in parent room cache if present
      const segments = path.split("/");
      if (segments.length >= 3) {
        const rootPath = segments.slice(0, 2).join("/");
        const roomObj = (await this.get(rootPath)) || {};
        let cursor = roomObj;
        for (let i = 2; i < segments.length - 1; i++) {
          if (cursor[segments[i]]) cursor = cursor[segments[i]];
        }
        delete cursor[segments[segments.length - 1]];
        localStorage.setItem("db_" + rootPath, JSON.stringify(roomObj));
      }
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ path, data: null });
      }
      this.triggerLocalListeners(path, null);
      return Promise.resolve();
    }
  }

  async get(path) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      const { ref, get } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      const snap = await get(ref(this.fbDb, path));
      return snap.exists() ? snap.val() : null;
    } else {
      const item = localStorage.getItem("db_" + path);
      return item ? JSON.parse(item) : null;
    }
  }

  async update(path, partialData) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      const { ref, update } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      return update(ref(this.fbDb, path), partialData);
    } else {
      const current = (await this.get(path)) || {};
      const merged = { ...current, ...partialData };
      return this.set(path, merged);
    }
  }

  async listen(path, callback) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      const { ref, onValue } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
      const unsubscribe = onValue(ref(this.fbDb, path), (snapshot) => {
        callback(snapshot.val());
      });
      return unsubscribe;
    } else {
      if (!this.listeners.has(path)) {
        this.listeners.set(path, new Set());
      }
      this.listeners.get(path).add(callback);

      // Trigger initial read
      const current = await this.get(path);
      callback(current);

      return () => {
        if (this.listeners.has(path)) {
          this.listeners.get(path).delete(callback);
        }
      };
    }
  }

  triggerLocalListeners(path, data) {
    // Notify exact and parent listeners
    for (const [listenPath, callbacks] of this.listeners.entries()) {
      if (listenPath === path || path.startsWith(listenPath + "/")) {
        callbacks.forEach(cb => {
          try {
            cb(data);
          } catch (e) {
            console.error(e);
          }
        });
      }
    }
  }
}

const db = new DatabaseService();

// ============================================================================
// GAME CLIENT STATE & CONTROLLER
// ============================================================================

class GameController {
  constructor() {
    this.myPlayerId = null;
    this.myPlayerName = "";
    this.currentRoomCode = null;
    this.isHost = false;
    this.roomData = null;
    this.roomUnsubscribe = null;

    // UI state
    this.selectedTargetPlayerId = null;
    this.viewingPlayerId = null; // board viewing
    this.isViewingMySecretList = false;
    this.category = "singers";
    this.activeHintTargetSlot = null;
    this.seenHints = new Set();
    this.connectedTimestamp = Date.now();

    this.cacheDomElements();
    this.bindEvents();
    this.checkSavedSession();
  }

  cacheDomElements() {
    // Views
    this.views = {
      home: document.getElementById("view-home"),
      lobby: document.getElementById("view-lobby"),
      entry: document.getElementById("view-entry"),
      game: document.getElementById("view-game"),
      gameOver: document.getElementById("view-game-over")
    };

    // Header & Alert
    this.headerRoomTag = document.getElementById("header-room-tag");
    this.headerRoomCode = document.getElementById("header-room-code");
    this.btnHeaderMyList = document.getElementById("btn-header-my-list");
    this.systemAlertBanner = document.getElementById("system-alert-banner");
    this.systemAlertText = document.getElementById("system-alert-text");
    this.btnCloseAlert = document.getElementById("btn-close-alert");

    // My List Drawer Modal
    this.modalMyList = document.getElementById("modal-my-list");
    this.myListDrawerSlots = document.getElementById("my-list-drawer-slots");
    this.btnCloseMyList = document.getElementById("btn-close-my-list");
    this.btnDismissMyList = document.getElementById("btn-dismiss-my-list");

    // Home
    this.inputPlayerName = document.getElementById("input-player-name");
    this.inputRoomCode = document.getElementById("input-room-code");
    this.btnCreateRoom = document.getElementById("btn-create-room");
    this.btnJoinRoom = document.getElementById("btn-join-room");
    this.reconnectBox = document.getElementById("reconnect-box");
    this.reconnectRoomLabel = document.getElementById("reconnect-room-label");
    this.reconnectNameLabel = document.getElementById("reconnect-name-label");
    this.btnReconnect = document.getElementById("btn-reconnect");
    this.btnDiscardSession = document.getElementById("btn-discard-session");

    // Lobby
    this.lobbyRoomCode = document.getElementById("lobby-room-code");
    this.btnCopyCode = document.getElementById("btn-copy-code");
    this.btnShareLink = document.getElementById("btn-share-link");
    this.categoryOptionBtns = document.querySelectorAll(".category-option-btn");
    this.categoryBadgeNote = document.getElementById("category-badge-note");
    this.lobbyPlayerList = document.getElementById("lobby-player-list");
    this.lobbyPlayerCount = document.getElementById("lobby-player-count");
    this.lobbyMinPlayersAlert = document.getElementById("lobby-min-players-alert");
    this.btnStartMatch = document.getElementById("btn-start-match");
    this.btnLeaveRoom = document.getElementById("btn-leave-room");

    // Entry Phase
    this.entryCategoryTitle = document.getElementById("entry-category-title");
    this.restoreBanner = document.getElementById("restore-banner");
    this.restoreCategoryLabel = document.getElementById("restore-category-label");
    this.btnRestoreLastList = document.getElementById("btn-restore-last-list");
    this.entrySlotsContainer = document.getElementById("entry-slots-container");
    this.btnSubmitList = document.getElementById("btn-submit-list");
    this.entryErrorBanner = document.getElementById("entry-error-banner");
    this.entryWaitingCard = document.getElementById("entry-waiting-card");
    this.entryLockedCount = document.getElementById("entry-locked-count");
    this.entryStatusRoster = document.getElementById("entry-status-roster");

    // Main Game Phase
    this.actionFeedText = document.getElementById("action-feed-text");
    this.actionFeedTime = document.getElementById("action-feed-time");
    this.turnOrderContainer = document.getElementById("turn-order-container");
    this.gameRoundIndicator = document.getElementById("game-round-indicator");
    this.activeTurnControl = document.getElementById("active-turn-control");
    this.passiveTurnBanner = document.getElementById("passive-turn-banner");
    this.passiveActivePlayerName = document.getElementById("passive-active-player-name");
    this.targetPlayerGrid = document.getElementById("target-player-grid");
    this.inputTurnGuess = document.getElementById("input-turn-guess");
    this.btnSubmitGuess = document.getElementById("btn-submit-guess");
    this.turnAutocompleteDropdown = document.getElementById("turn-autocomplete-dropdown");
    this.playerTabsBar = document.getElementById("player-tabs-bar");
    this.btnToggleMyList = document.getElementById("btn-toggle-my-list");
    this.selectedBoardPlayerName = document.getElementById("selected-board-player-name");
    this.selectedBoardStatusBadge = document.getElementById("selected-board-status-badge");
    this.selectedBoardScoreTag = document.getElementById("selected-board-score-tag");
    this.boardSlotsList = document.getElementById("board-slots-list");
    this.liveStandingsGrid = document.getElementById("live-standings-grid");

    // Live Target Confirmation Modal (Layer 3)
    this.modalConfirmation = document.getElementById("modal-confirmation");
    this.confirmGuesserName = document.getElementById("confirm-guesser-name");
    this.confirmGuessText = document.getElementById("confirm-guess-text");
    this.confirmSlotsContainer = document.getElementById("confirm-slots-container");
    this.btnConfirmWrong = document.getElementById("btn-confirm-wrong");
    this.waitingConfirmationBackdrop = document.getElementById("waiting-confirmation-backdrop");
    this.specTargetName = document.getElementById("spec-target-name");
    this.specGuessText = document.getElementById("spec-guess-text");

    // Pause Overlay Modal
    this.modalPauseOverlay = document.getElementById("modal-pause-overlay");
    this.pauseRoomCodeTag = document.getElementById("pause-room-code-tag");
    this.pauseDisconnectedNames = document.getElementById("pause-disconnected-names");
    this.pauseHostActions = document.getElementById("pause-host-actions");
    this.pauseKickButtonsContainer = document.getElementById("pause-kick-buttons-container");

    // Give Hint Modal
    this.modalGiveHint = document.getElementById("modal-give-hint");
    this.hintModalSlotTitle = document.getElementById("hint-modal-slot-title");
    this.btnCloseGiveHint = document.getElementById("btn-close-give-hint");
    this.btnHintFirstLetter = document.getElementById("btn-hint-first-letter");
    this.hintFirstLetterPreview = document.getElementById("hint-first-letter-preview");
    this.btnHintWordCount = document.getElementById("btn-hint-word-count");
    this.hintWordCountPreview = document.getElementById("hint-word-count-preview");
    this.inputCustomHint = document.getElementById("input-custom-hint");
    this.btnSubmitCustomHint = document.getElementById("btn-submit-custom-hint");
    this.customHintError = document.getElementById("custom-hint-error");

    // Game Over View
    this.podiumWinnerName = document.getElementById("podium-winner-name");
    this.finalLeaderboardList = document.getElementById("final-leaderboard-list");
    this.finalAllListsContainer = document.getElementById("final-all-lists-container");
    this.btnReturnHome = document.getElementById("btn-return-home");
    this.btnPlayAgain = document.getElementById("btn-play-again");
    this.playAgainNote = document.getElementById("play-again-note");
  }

  bindEvents() {
    // Navigation / Alerts
    this.btnCloseAlert.addEventListener("click", () => this.hideAlert());

    // My List Drawer Toggle
    this.btnHeaderMyList.addEventListener("click", () => this.toggleMyListDrawer());
    this.btnCloseMyList.addEventListener("click", () => this.toggleMyListDrawer(false));
    this.btnDismissMyList.addEventListener("click", () => this.toggleMyListDrawer(false));
    this.modalMyList.addEventListener("click", (e) => {
      if (e.target === this.modalMyList) {
        this.toggleMyListDrawer(false);
      }
    });

    // Window disconnect handler (sets connected to false without destroying room)
    window.addEventListener("beforeunload", () => {
      if (this.currentRoomCode && this.myPlayerId) {
        db.setPlayerConnected(this.currentRoomCode, this.myPlayerId, false);
      }
    });

    // Give Hint Modal Events
    this.btnCloseGiveHint.addEventListener("click", () => this.closeGiveHintModal());
    this.modalGiveHint.addEventListener("click", (e) => {
      if (e.target === this.modalGiveHint) this.closeGiveHintModal();
    });
    this.btnHintFirstLetter.addEventListener("click", () => this.submitFirstLetterHint());
    this.btnHintWordCount.addEventListener("click", () => this.submitWordCountHint());
    this.btnSubmitCustomHint.addEventListener("click", () => this.submitCustomHint());
    this.inputCustomHint.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitCustomHint();
    });

    // Home
    this.btnCreateRoom.addEventListener("click", () => this.handleCreateRoom());
    this.btnJoinRoom.addEventListener("click", () => this.handleJoinRoom());
    this.inputRoomCode.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    });
    this.btnReconnect.addEventListener("click", () => this.handleReconnect());
    this.btnDiscardSession.addEventListener("click", () => this.discardSession());

    // Lobby
    this.btnCopyCode.addEventListener("click", () => this.copyRoomCode());
    this.btnShareLink.addEventListener("click", () => this.shareRoomLink());
    this.categoryOptionBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!this.isHost) return;
        const cat = e.currentTarget.dataset.category;
        this.setMatchCategory(cat);
      });
    });
    this.btnStartMatch.addEventListener("click", () => this.handleStartMatch());
    this.btnLeaveRoom.addEventListener("click", () => this.handleLeaveRoom());

    // Entry Phase
    this.btnRestoreLastList.addEventListener("click", () => this.restoreLastList());
    this.btnSubmitList.addEventListener("click", () => this.handleSubmitSecretList());

    // Game Phase
    this.inputTurnGuess.addEventListener("input", (e) => this.handleTurnGuessInput(e.target.value));
    this.inputTurnGuess.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.btnSubmitGuess.disabled) {
        this.handleSubmitTurnGuess();
      }
    });
    this.btnSubmitGuess.addEventListener("click", () => this.handleSubmitTurnGuess());
    this.btnToggleMyList.addEventListener("click", () => this.toggleMySecretList());

    // Confirmation Layer 3
    this.btnConfirmWrong.addEventListener("click", () => this.handleConfirmResponse(null));

    // Game Over
    this.btnReturnHome.addEventListener("click", () => this.leaveRoom());
    this.btnPlayAgain.addEventListener("click", () => this.handlePlayAgain());

    // Close autocompletes on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".slot-input-wrapper") && !e.target.closest(".guess-input-row")) {
        document.querySelectorAll(".autocomplete-dropdown").forEach(el => el.classList.remove("open"));
      }
    });
  }

  // ==========================================================================
  // VIEW SWITCHER
  // ==========================================================================

  switchView(viewName) {
    Object.values(this.views).forEach(el => el.classList.remove("active"));
    if (this.views[viewName]) {
      this.views[viewName].classList.add("active");
    }

    if (viewName === "home") {
      this.headerRoomTag.classList.add("hidden");
    } else if (this.currentRoomCode) {
      this.headerRoomTag.classList.remove("hidden");
      this.headerRoomCode.textContent = this.currentRoomCode;
    }
  }

  showAlert(message) {
    this.systemAlertText.textContent = message;
    this.systemAlertBanner.classList.remove("hidden");
  }

  hideAlert() {
    this.systemAlertBanner.classList.add("hidden");
  }

  // ==========================================================================
  // SESSION PERSISTENCE & RECONNECTION
  // ==========================================================================

  checkSavedSession() {
    const savedId = localStorage.getItem("ta5mena_player_id");
    const savedName = localStorage.getItem("ta5mena_player_name");
    const savedRoom = localStorage.getItem("ta5mena_room_code");

    if (savedName) {
      this.inputPlayerName.value = savedName;
      this.myPlayerName = savedName;
    }

    if (savedId && savedRoom && savedName) {
      this.reconnectRoomLabel.textContent = savedRoom;
      this.reconnectNameLabel.textContent = savedName;
      this.reconnectBox.classList.remove("hidden");
      // Auto-reconnect seamlessly if room and player exist
      this.handleReconnect(true);
    }
  }

  saveSession(playerId, name, roomCode) {
    this.myPlayerId = playerId;
    this.myPlayerName = name;
    this.currentRoomCode = roomCode;
    localStorage.setItem("ta5mena_player_id", playerId);
    localStorage.setItem("ta5mena_player_name", name);
    localStorage.setItem("ta5mena_room_code", roomCode);
  }

  discardSession() {
    localStorage.removeItem("ta5mena_player_id");
    localStorage.removeItem("ta5mena_room_code");
    this.reconnectBox.classList.add("hidden");
  }

  async handleReconnect(isAuto = false) {
    const savedId = localStorage.getItem("ta5mena_player_id");
    const savedName = localStorage.getItem("ta5mena_player_name");
    const savedRoom = localStorage.getItem("ta5mena_room_code");

    if (!savedId || !savedRoom || !savedName) return;

    const room = await db.get(`rooms/${savedRoom}`);
    if (!room) {
      if (!isAuto) this.showAlert("Room no longer exists.");
      this.discardSession();
      return;
    }

    if (!room.players || !room.players[savedId]) {
      if (!isAuto) this.showAlert("Player session not found in this room.");
      this.discardSession();
      return;
    }

    this.myPlayerId = savedId;
    this.myPlayerName = savedName;
    this.currentRoomCode = savedRoom;
    this.reconnectBox.classList.add("hidden");

    await db.setPlayerConnected(savedRoom, savedId, true);
    await db.trackPlayerConnection(savedRoom, savedId);
    this.subscribeToRoom(savedRoom);
    this.showAlert(`Reconnected to room ${savedRoom} as ${savedName}!`);
  }

  // ==========================================================================
  // ROOM CREATION & JOINING
  // ==========================================================================

  generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  generatePlayerId() {
    return "p_" + Math.random().toString(36).substring(2, 10);
  }

  async handleCreateRoom() {
    const name = this.inputPlayerName.value.trim();
    if (!name) {
      this.showAlert("Please enter your name first.");
      this.inputPlayerName.focus();
      return;
    }

    const roomCode = this.generateRoomCode();
    const playerId = this.generatePlayerId();

    const initialRoom = {
      meta: {
        code: roomCode,
        hostId: playerId,
        category: "singers",
        status: "lobby",
        createdAt: Date.now()
      },
      players: {
        [playerId]: {
          id: playerId,
          name: name,
          isHost: true,
          points: 0,
          listSubmitted: false,
          targetCompleted: false,
          connected: true
        }
      },
      lists: {},
      game: {
        turnOrder: [],
        currentTurnIndex: 0,
        activePlayerId: null,
        round: 1,
        lastAction: {
          text: `Room created by ${name}. Waiting for players.`,
          timestamp: Date.now()
        },
        confirmation: null
      }
    };

    await db.set(`rooms/${roomCode}`, initialRoom);
    await db.trackPlayerConnection(roomCode, playerId);
    this.saveSession(playerId, name, roomCode);
    this.subscribeToRoom(roomCode);
  }

  async handleJoinRoom() {
    const name = this.inputPlayerName.value.trim();
    const code = this.inputRoomCode.value.trim().toUpperCase();

    if (!name) {
      this.showAlert("Please enter your name first.");
      this.inputPlayerName.focus();
      return;
    }
    if (code.length !== 4) {
      this.showAlert("Room code must be 4 characters.");
      this.inputRoomCode.focus();
      return;
    }

    const room = await db.get(`rooms/${code}`);
    if (!room) {
      this.showAlert(`Room "${code}" not found.`);
      return;
    }

    // Check if an existing player has the exact same name (case-insensitive)
    const existingPlayer = Object.values(room.players || {}).find(
      p => p.name && p.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (existingPlayer) {
      // Reconnect to existing player seat!
      this.saveSession(existingPlayer.id, existingPlayer.name, code);
      await db.setPlayerConnected(code, existingPlayer.id, true);
      await db.trackPlayerConnection(code, existingPlayer.id);
      this.subscribeToRoom(code);
      this.showAlert(`Welcome back, ${existingPlayer.name}! Reconnected to seat.`);
      return;
    }

    if (room.meta.status !== "lobby") {
      this.showAlert("This match has already started and no seat matching your name was found.");
      return;
    }

    const playerId = this.generatePlayerId();
    const newPlayer = {
      id: playerId,
      name: name,
      isHost: false,
      points: 0,
      listSubmitted: false,
      targetCompleted: false,
      connected: true
    };

    await db.update(`rooms/${code}/players/${playerId}`, newPlayer);
    await db.trackPlayerConnection(code, playerId);
    this.saveSession(playerId, name, code);
    this.subscribeToRoom(code);
  }

  async handleLeaveRoom() {
    if (!this.currentRoomCode) return;
    if (this.isHost) {
      const confirmClose = confirm("You are the Host. Leaving will close the room for everyone. Are you sure?");
      if (!confirmClose) return;
      await db.update(`rooms/${this.currentRoomCode}/meta`, {
        status: "aborted",
        abortedReason: "The Host left the room. Match closed."
      });
    } else {
      const confirmLeave = confirm("Are you sure you want to leave this room?");
      if (!confirmLeave) return;
      await db.remove(`rooms/${this.currentRoomCode}/players/${this.myPlayerId}`);
      await db.remove(`rooms/${this.currentRoomCode}/lists/${this.myPlayerId}`);
      if (this.roomData?.meta?.status === "playing") {
        await this.cleanUpDepartedPlayer(this.myPlayerId, this.myPlayerName);
      }
    }
    this.leaveRoom();
  }

  leaveRoom() {
    if (this.roomUnsubscribe) {
      this.roomUnsubscribe();
      this.roomUnsubscribe = null;
    }
    if (this.currentRoomCode && this.myPlayerId) {
      db.stopPlayerConnectionTracking(this.currentRoomCode, this.myPlayerId);
    }
    this.discardSession();
    this.currentRoomCode = null;
    this.roomData = null;
    this.btnHeaderMyList?.classList.add("hidden");
    this.modalMyList?.classList.remove("open");
    if (this.modalConfirmation) this.modalConfirmation.classList.remove("open");
    if (this.waitingConfirmationBackdrop) this.waitingConfirmationBackdrop.classList.remove("open");
    this.hidePauseOverlay();
    this.closeGiveHintModal();
    this.switchView("home");
  }

  // ==========================================================================
  // REALTIME SUBSCRIPTION & ROUTER
  // ==========================================================================

  async subscribeToRoom(roomCode) {
    if (this.roomUnsubscribe) {
      this.roomUnsubscribe();
    }

    this.roomUnsubscribe = await db.listen(`rooms/${roomCode}`, async (room) => {
      if (!room) {
        this.leaveRoom();
        this.showAlert("Room has been closed or removed.");
        return;
      }

      // Check aborted status flag (player left/disconnected)
      if (room.meta && room.meta.status === "aborted") {
        const reason = room.meta.abortedReason || "A player left or disconnected. Room closed.";
        this.leaveRoom();
        this.showAlert(reason);
        return;
      }

      this.roomData = room;
      const me = room.players ? room.players[this.myPlayerId] : null;
      if (!me) {
        this.leaveRoom();
        this.showAlert("You were removed from the room by the host.");
        return;
      }

      this.isHost = me.isHost || (room.meta.hostId === this.myPlayerId);
      this.category = room.meta.category || "singers";

      // Check pause state: if any player has connected === false during match, show pause overlay
      this.checkGamePauseState(room);

      // Check if any opponent dropped hints
      this.checkForNewHints(room);

      this.updateMyListButtonVisibility(room);
      this.routeRoomState(room);
    });
  }

  // --------------------------------------------------------------------------
  // GAME PAUSE & DISCONNECT OVERLAY ENGINE
  // --------------------------------------------------------------------------

  checkGamePauseState(room) {
    if (!room || !room.meta || (room.meta.status !== "playing" && room.meta.status !== "entry")) {
      this.hidePauseOverlay();
      return false;
    }

    const players = Object.values(room.players || {});
    const disconnected = players.filter(p => p.connected === false);

    if (disconnected.length > 0) {
      this.showPauseOverlay(room, disconnected);
      return true;
    } else {
      this.hidePauseOverlay();
      return false;
    }
  }

  showPauseOverlay(room, disconnected) {
    if (!this.modalPauseOverlay) return;
    this.modalPauseOverlay.classList.add("open");
    this.pauseRoomCodeTag.textContent = `ROOM: ${room.meta.code}`;
    const names = disconnected.map(p => p.name).join(", ");
    this.pauseDisconnectedNames.textContent = names;

    if (this.isHost) {
      this.pauseHostActions.classList.remove("hidden");
      this.pauseKickButtonsContainer.innerHTML = "";
      disconnected.forEach(p => {
        const btn = document.createElement("button");
        btn.className = "btn btn-danger btn-block";
        btn.style.height = "auto";
        btn.style.padding = "8px 12px";
        btn.style.fontSize = "12px";
        btn.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          KICK ${this.escapeHtml(p.name.toUpperCase())} & CONTINUE
        `;
        btn.addEventListener("click", () => this.handleKickDisconnectedPlayer(p.id, p.name));
        this.pauseKickButtonsContainer.appendChild(btn);
      });
    } else {
      this.pauseHostActions.classList.add("hidden");
    }
  }

  hidePauseOverlay() {
    if (this.modalPauseOverlay) {
      this.modalPauseOverlay.classList.remove("open");
    }
  }

  async handleKickDisconnectedPlayer(kickedId, kickedName) {
    if (!this.isHost || !this.currentRoomCode) return;
    const confirmKick = confirm(`Are you sure you want to kick ${kickedName} and continue the match?`);
    if (!confirmKick) return;

    await db.remove(`rooms/${this.currentRoomCode}/players/${kickedId}`);
    await db.remove(`rooms/${this.currentRoomCode}/lists/${kickedId}`);

    const room = this.roomData;
    if (!room) return;

    if (room.meta.status === "playing") {
      await this.cleanUpDepartedPlayer(kickedId, kickedName);
    } else if (room.meta.status === "entry") {
      const remaining = Object.values(room.players || {}).filter(p => p.id !== kickedId);
      if (remaining.length >= 2 && remaining.every(p => p.listSubmitted)) {
        await this.checkAllListsSubmitted(room);
      }
    }
    this.showAlert(`${kickedName} was removed. Match resuming.`);
  }

  async cleanUpDepartedPlayer(kickedId, kickedName) {
    const game = this.roomData?.game || {};
    const currentTurnOrder = game.turnOrder || [];
    const updatedTurnOrder = currentTurnOrder.filter(id => id !== kickedId);

    if (updatedTurnOrder.length < 2) {
      await db.update(`rooms/${this.currentRoomCode}/meta`, {
        status: "aborted",
        abortedReason: "Not enough players remaining to continue. Match closed."
      });
      return;
    }

    const updates = {
      "game/turnOrder": updatedTurnOrder
    };

    if (game.confirmation && (game.confirmation.toPlayerId === kickedId || game.confirmation.fromPlayerId === kickedId)) {
      updates["game/confirmation"] = null;
    }

    if (game.activePlayerId === kickedId) {
      let newTurnIndex = (game.currentTurnIndex || 0) % updatedTurnOrder.length;
      updates["game/currentTurnIndex"] = newTurnIndex;
      updates["game/activePlayerId"] = updatedTurnOrder[newTurnIndex];
      updates["game/confirmation"] = null;
    } else {
      const currentActiveId = game.activePlayerId;
      const newIndex = updatedTurnOrder.indexOf(currentActiveId);
      if (newIndex !== -1) {
        updates["game/currentTurnIndex"] = newIndex;
      }
    }

    updates["game/lastAction"] = {
      text: `${kickedName} was removed. Continuing match.`,
      timestamp: Date.now()
    };

    await db.update(`rooms/${this.currentRoomCode}`, updates);
  }

  // --------------------------------------------------------------------------
  // LIVE HINT SYSTEM ENGINE
  // --------------------------------------------------------------------------

  checkForNewHints(room) {
    if (!room || !room.players) return;
    Object.entries(room.players).forEach(([pid, p]) => {
      if (p.hints) {
        Object.entries(p.hints).forEach(([slotRank, hint]) => {
          const hintKey = `${pid}_${slotRank}_${hint.timestamp}`;
          if (!this.seenHints.has(hintKey)) {
            this.seenHints.add(hintKey);
            // If dropped by an opponent, show toast
            if (pid !== this.myPlayerId && hint.timestamp > (this.connectedTimestamp - 5000)) {
              this.showAlert(`${p.name} dropped a hint for their #${slotRank} slot!`);
            }
          }
        });
      }
    });
  }

  openGiveHintModal(rank, item) {
    this.activeHintTargetSlot = { rank, item };
    this.hintModalSlotTitle.textContent = `Give Hint for Slot #${rank} ("${item}")`;
    this.customHintError.classList.add("hidden");
    this.inputCustomHint.value = "";

    // Option 1 preview: First letter
    const cleanItem = (item || "").trim().replace(/^["']/, "");
    const firstChar = cleanItem.charAt(0);
    const firstLetterHint = `Starts with '${firstChar.toUpperCase()}'`;
    this.hintFirstLetterPreview.textContent = firstLetterHint;

    // Option 2 preview: Word count & length
    const words = cleanItem.split(/\s+/).filter(w => w.length > 0);
    const wordCountText = `${words.length} ${words.length === 1 ? 'word' : 'words'} (${words.map(w => `${w.length} letters`).join(", ")})`;
    this.hintWordCountPreview.textContent = wordCountText;

    this.modalGiveHint.classList.add("open");
  }

  closeGiveHintModal() {
    this.activeHintTargetSlot = null;
    if (this.modalGiveHint) {
      this.modalGiveHint.classList.remove("open");
    }
  }

  async submitFirstLetterHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    const cleanItem = (item || "").trim().replace(/^["']/, "");
    const firstChar = cleanItem.charAt(0);
    const hintText = `Starts with '${firstChar.toUpperCase()}'`;
    await this.broadcastHint(rank, "first_letter", hintText);
  }

  async submitWordCountHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    const cleanItem = (item || "").trim().replace(/^["']/, "");
    const words = cleanItem.split(/\s+/).filter(w => w.length > 0);
    const hintText = `${words.length} ${words.length === 1 ? 'word' : 'words'} (${words.map(w => `${w.length} letters`).join(", ")})`;
    await this.broadcastHint(rank, "word_count", hintText);
  }

  async submitCustomHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    const customVal = this.inputCustomHint.value.trim();

    if (!customVal) {
      this.customHintError.textContent = "Please enter a short clue.";
      this.customHintError.classList.remove("hidden");
      return;
    }

    const normCustom = normalizeText(customVal);
    const normItem = normalizeText(item);
    if (normCustom === normItem || (normItem.length > 3 && normCustom.includes(normItem))) {
      this.customHintError.textContent = "Hint cannot contain the exact secret answer!";
      this.customHintError.classList.remove("hidden");
      return;
    }

    await this.broadcastHint(rank, "custom", customVal);
  }

  async broadcastHint(rank, type, hintText) {
    if (!this.currentRoomCode || !this.myPlayerId) return;
    const hintData = {
      type: type,
      text: hintText,
      timestamp: Date.now()
    };

    const updates = {};
    updates[`players/${this.myPlayerId}/hints/${rank}`] = hintData;
    updates[`game/lastAction`] = {
      text: `${this.myPlayerName} dropped a hint for their #${rank} slot!`,
      timestamp: Date.now()
    };

    await db.update(`rooms/${this.currentRoomCode}`, updates);
    this.closeGiveHintModal();
    this.showAlert(`Hint broadcast for slot #${rank}: "${hintText}"`);

    if (this.modalMyList.classList.contains("open")) {
      this.renderMyListDrawer();
    }
  }

  updateMyListButtonVisibility(room) {
    if (!room || !this.myPlayerId) {
      this.btnHeaderMyList.classList.add("hidden");
      return;
    }
    const me = room.players ? room.players[this.myPlayerId] : null;
    const isEntryLocked = (room.meta?.status === "entry" && me && me.listSubmitted);
    const isPlaying = (room.meta?.status === "playing");
    const show = !!(isEntryLocked || isPlaying);
    this.btnHeaderMyList.classList.toggle("hidden", !show);

    // If modal is currently open, live update its slots
    if (this.modalMyList.classList.contains("open")) {
      this.renderMyListDrawer();
    }
  }

  routeRoomState(room) {
    const status = room.meta.status;

    if (status === "lobby") {
      this.renderLobby(room);
      this.switchView("lobby");
    } else if (status === "entry") {
      this.renderEntryPhase(room);
      this.switchView("entry");
    } else if (status === "playing") {
      this.renderMainGame(room);
      this.switchView("game");
    } else if (status === "game_over") {
      this.renderGameOver(room);
      this.switchView("game_over");
    }
  }

  // ==========================================================================
  // VIEW 2: LOBBY LOGIC
  // ==========================================================================

  renderLobby(room) {
    this.lobbyRoomCode.textContent = room.meta.code;
    const players = Object.values(room.players || {});
    const playerCount = players.length;

    this.lobbyPlayerCount.textContent = `${playerCount} / MIN 3`;

    // Category options
    this.categoryOptionBtns.forEach(btn => {
      const cat = btn.dataset.category;
      if (cat === room.meta.category) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
      btn.style.cursor = this.isHost ? "pointer" : "default";
    });

    if (this.isHost) {
      this.categoryBadgeNote.textContent = "HOST SELECTS";
    } else {
      this.categoryBadgeNote.textContent = "HOST SELECTION";
    }

    // Render roster
    this.lobbyPlayerList.innerHTML = "";
    players.forEach(p => {
      const item = document.createElement("div");
      item.className = "roster-item" + (p.id === this.myPlayerId ? " is-me" : "") + (p.isHost ? " is-host" : "");

      const isHostTag = p.isHost ? '<span class="badge badge-accent">HOST</span>' : '';
      const isYouTag = p.id === this.myPlayerId ? '<span class="badge">YOU</span>' : '';
      const isKickable = this.isHost && p.id !== this.myPlayerId;

      item.innerHTML = `
        <div class="roster-item-info">
          <span class="player-name">${this.escapeHtml(p.name)}</span>
          ${isHostTag}
          ${isYouTag}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="mono text-secondary" style="font-size: 11px;">READY</span>
          ${isKickable ? `<button class="btn btn-kick" data-kick-id="${p.id}">KICK</button>` : ''}
        </div>
      `;

      if (isKickable) {
        const kickBtn = item.querySelector(`[data-kick-id="${p.id}"]`);
        if (kickBtn) {
          kickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleKickPlayer(p.id, p.name);
          });
        }
      }

      this.lobbyPlayerList.appendChild(item);
    });

    // Min players check (3 minimum as strictly required)
    const canStart = playerCount >= 3;
    if (this.isHost) {
      this.btnStartMatch.disabled = !canStart;
      this.btnStartMatch.textContent = canStart ? "Start Match" : "Need 3+ Players";
      this.lobbyMinPlayersAlert.classList.toggle("hidden", canStart);
    } else {
      this.btnStartMatch.disabled = true;
      this.btnStartMatch.textContent = "Waiting for Host to start...";
      this.lobbyMinPlayersAlert.classList.toggle("hidden", canStart);
    }
  }

  async setMatchCategory(cat) {
    if (!this.isHost || !this.currentRoomCode) return;
    await db.update(`rooms/${this.currentRoomCode}/meta`, { category: cat });
  }

  async handleStartMatch() {
    if (!this.isHost || !this.currentRoomCode) return;
    const players = Object.values(this.roomData.players || {});
    if (players.length < 3) {
      this.showAlert("Minimum 3 players required to start the match.");
      return;
    }

    await db.update(`rooms/${this.currentRoomCode}/meta`, { status: "entry" });
  }

  async handleKickPlayer(kickedPlayerId, kickedPlayerName) {
    if (!this.isHost || !this.currentRoomCode || kickedPlayerId === this.myPlayerId) return;

    const room = this.roomData;
    if (!room || !room.players || !room.players[kickedPlayerId]) return;

    const confirmKick = confirm(`Are you sure you want to remove ${kickedPlayerName}?`);
    if (!confirmKick) return;

    await db.remove(`rooms/${this.currentRoomCode}/players/${kickedPlayerId}`);
    await db.remove(`rooms/${this.currentRoomCode}/lists/${kickedPlayerId}`);

    if (room.meta && room.meta.status === "playing") {
      await this.cleanUpDepartedPlayer(kickedPlayerId, kickedPlayerName);
    } else if (room.meta && room.meta.status === "entry") {
      const remaining = Object.values(room.players || {}).filter(p => p.id !== kickedPlayerId);
      if (remaining.length >= 2 && remaining.every(p => p.listSubmitted)) {
        await this.checkAllListsSubmitted(room);
      }
    }

    this.showAlert(`Removed ${kickedPlayerName}.`);
  }

  copyRoomCode() {
    if (!this.currentRoomCode) return;
    navigator.clipboard.writeText(this.currentRoomCode).then(() => {
      this.showAlert(`Room code ${this.currentRoomCode} copied to clipboard.`);
    }).catch(() => {
      this.showAlert(`Room code: ${this.currentRoomCode}`);
    });
  }

  shareRoomLink() {
    if (!this.currentRoomCode) return;
    const url = window.location.origin + window.location.pathname + `?room=${this.currentRoomCode}`;
    if (navigator.share) {
      navigator.share({
        title: "Join Ta5mena Room",
        text: `Join my Top 10 game on Ta5mena! Room code: ${this.currentRoomCode}`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.showAlert("Invite link copied to clipboard.");
      });
    }
  }

  // ==========================================================================
  // VIEW 3: SECRET LIST ENTRY PHASE LOGIC
  // ==========================================================================

  getCategoryTitle(cat) {
    if (cat === "singers") return "Top 10 Favorite Singers";
    if (cat === "football") return "Top 10 Football Players";
    if (cat === "actors") return "Top 10 Actors";
    if (cat === "clubs") return "Top 10 Football Clubs";
    if (cat === "countries") return "Top 10 Countries";
    if (cat === "series") return "Top 10 Series";
    if (cat === "movies") return "Top 10 Movies";
    if (cat === "foods") return "Top 10 Foods";
    return "Top 10 List";
  }

  renderEntryPhase(room) {
    const cat = room.meta.category || "singers";
    this.category = cat;
    this.entryCategoryTitle.textContent = this.getCategoryTitle(cat);

    const me = room.players[this.myPlayerId];
    const isSubmitted = me && me.listSubmitted;

    // Render slots input form if not yet created
    if (this.entrySlotsContainer.children.length === 0) {
      this.buildEntrySlots();
    }

    if (isSubmitted) {
      this.btnSubmitList.disabled = true;
      this.btnSubmitList.textContent = "Top 10 Locked In";
      // Disable inputs
      for (let i = 1; i <= 10; i++) {
        const input = document.getElementById(`entry-slot-input-${i}`);
        if (input) input.disabled = true;
      }
      if (this.restoreBanner) this.restoreBanner.classList.add("hidden");
      this.entryWaitingCard.classList.remove("hidden");
      this.updateEntryRosterStatus(room);
    } else {
      this.btnSubmitList.disabled = false;
      this.btnSubmitList.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Lock In My Top 10
      `;
      this.entryWaitingCard.classList.add("hidden");
      this.checkRestoreButtonVisibility();
    }

    // Check if ALL players have submitted their lists. If so, transition to 'playing'
    this.checkAllListsSubmitted(room);
  }

  buildEntrySlots() {
    this.entrySlotsContainer.innerHTML = "";
    for (let rank = 1; rank <= 10; rank++) {
      const row = document.createElement("div");
      row.className = "slot-row";
      row.innerHTML = `
        <div class="slot-rank-label">
          <span class="rank-num">#${rank}</span>
          <span class="rank-pts">${rank} ${rank === 1 ? 'pt' : 'pts'}</span>
        </div>
        <div class="slot-input-wrapper">
          <input type="text" id="entry-slot-input-${rank}" placeholder="Rank #${rank} (${rank} ${rank === 1 ? 'pt' : 'pts'})" autocomplete="off">
          <div id="autocomplete-slot-${rank}" class="autocomplete-dropdown"></div>
        </div>
      `;
      this.entrySlotsContainer.appendChild(row);

      const input = row.querySelector(`#entry-slot-input-${rank}`);
      const dropdown = row.querySelector(`#autocomplete-slot-${rank}`);
      input.addEventListener("input", () => this.backupSecretList());
      this.setupAutocomplete(input, dropdown);
    }
  }

  setupAutocomplete(inputElement, dropdownElement) {
    inputElement.addEventListener("input", (e) => {
      const q = e.target.value;
      if (!q || q.trim().length === 0) {
        dropdownElement.classList.remove("open");
        dropdownElement.innerHTML = "";
        return;
      }

      const matches = searchSuggestions(this.category, q, 7);
      if (matches.length === 0) {
        dropdownElement.classList.remove("open");
        dropdownElement.innerHTML = "";
        return;
      }

      dropdownElement.innerHTML = "";
      matches.forEach(m => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.innerHTML = `
          <span class="suggestion-name">${this.escapeHtml(m.name)}</span>
          <span class="suggestion-ar">${this.escapeHtml(m.ar || "")}</span>
        `;
        item.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          inputElement.value = m.name;
          dropdownElement.classList.remove("open");
          dropdownElement.innerHTML = "";
          this.backupSecretList();
        });
        dropdownElement.appendChild(item);
      });

      dropdownElement.classList.add("open");
    });

    inputElement.addEventListener("blur", () => {
      setTimeout(() => {
        dropdownElement.classList.remove("open");
      }, 200);
    });
  }

  async handleSubmitSecretList() {
    const slots = {};
    const seen = new Set();
    let hasBlank = false;
    let hasDuplicate = false;

    for (let rank = 1; rank <= 10; rank++) {
      const input = document.getElementById(`entry-slot-input-${rank}`);
      const val = input ? input.value.trim() : "";

      if (!val) {
        hasBlank = true;
        break;
      }

      const norm = normalizeText(val);
      if (seen.has(norm)) {
        hasDuplicate = true;
        break;
      }
      seen.add(norm);

      slots[rank] = {
        item: val,
        revealed: false,
        guessedBy: null,
        points: rank
      };
    }

    if (hasBlank || hasDuplicate) {
      this.entryErrorBanner.textContent = hasBlank
        ? "Please fill all 10 slots before submitting."
        : "Duplicate entries are not allowed on your list.";
      this.entryErrorBanner.classList.remove("hidden");
      return;
    }

    this.entryErrorBanner.classList.add("hidden");

    // Backup locally
    this.backupSecretList();

    // Save list and update player status
    await db.set(`rooms/${this.currentRoomCode}/lists/${this.myPlayerId}`, slots);
    await db.update(`rooms/${this.currentRoomCode}/players/${this.myPlayerId}`, { listSubmitted: true });
  }

  backupSecretList() {
    const items = {};
    let filledCount = 0;
    for (let rank = 1; rank <= 10; rank++) {
      const input = document.getElementById(`entry-slot-input-${rank}`);
      const val = input ? input.value.trim() : "";
      items[rank] = val;
      if (val) filledCount++;
    }

    if (filledCount > 0) {
      const cat = this.category || "singers";
      const backupData = {
        category: cat,
        items: items,
        timestamp: Date.now()
      };
      localStorage.setItem(`ta5mena_last_list_${cat}`, JSON.stringify(backupData));
      localStorage.setItem("ta5mena_last_list", JSON.stringify(backupData));
      this.checkRestoreButtonVisibility();
    }
  }

  checkRestoreButtonVisibility() {
    if (!this.restoreBanner) return;
    const cat = this.category || "singers";
    let raw = localStorage.getItem(`ta5mena_last_list_${cat}`);
    if (!raw) {
      const fallback = localStorage.getItem("ta5mena_last_list");
      if (fallback) {
        try {
          const parsed = JSON.parse(fallback);
          if (!parsed.category || parsed.category === cat) {
            raw = fallback;
          }
        } catch (e) {}
      }
    }

    if (!raw) {
      this.restoreBanner.classList.add("hidden");
      return;
    }

    try {
      const data = JSON.parse(raw);
      const items = data.items || data;
      const filled = Object.values(items).filter(v => typeof v === "string" && v.trim().length > 0);
      if (filled.length > 0) {
        const catKey = data.category || cat;
        this.restoreCategoryLabel.textContent = catKey.toUpperCase().replace(/_/g, " ");
        this.restoreBanner.classList.remove("hidden");
      } else {
        this.restoreBanner.classList.add("hidden");
      }
    } catch (e) {
      this.restoreBanner.classList.add("hidden");
    }
  }

  restoreLastList() {
    const cat = this.category || "singers";
    let raw = localStorage.getItem(`ta5mena_last_list_${cat}`);
    if (!raw) {
      raw = localStorage.getItem("ta5mena_last_list");
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const items = data.items || data;

      for (let rank = 1; rank <= 10; rank++) {
        const input = document.getElementById(`entry-slot-input-${rank}`);
        if (input && items[rank] !== undefined) {
          input.value = items[rank];
        }
      }

      this.backupSecretList();
      const catTitle = this.getCategoryTitle(data.category || cat);
      this.showAlert(`Restored your 10 picks for ${catTitle}!`);
    } catch (err) {
      console.warn("Failed to restore list:", err);
    }
  }

  updateEntryRosterStatus(room) {
    const players = Object.values(room.players || {});
    let lockedCount = 0;
    this.entryStatusRoster.innerHTML = "";

    players.forEach(p => {
      if (p.listSubmitted) lockedCount++;
      const item = document.createElement("div");
      item.className = "lock-status-item";
      const isLocked = p.listSubmitted;
      const isKickable = this.isHost && p.id !== this.myPlayerId;

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${this.escapeHtml(p.name)} ${p.id === this.myPlayerId ? '(You)' : ''}</span>
          ${isKickable ? `<button class="btn btn-kick" data-kick-id="${p.id}">KICK</button>` : ''}
        </div>
        <span class="badge ${isLocked ? 'badge-success' : ''}">${isLocked ? 'LOCKED' : 'TYPING...'}</span>
      `;

      if (isKickable) {
        const kickBtn = item.querySelector(`[data-kick-id="${p.id}"]`);
        if (kickBtn) {
          kickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleKickPlayer(p.id, p.name);
          });
        }
      }

      this.entryStatusRoster.appendChild(item);
    });

    this.entryLockedCount.textContent = `${lockedCount} / ${players.length} LOCKED`;
  }

  async checkAllListsSubmitted(room) {
    const players = Object.values(room.players || {});
    if (players.length < 2) return;

    const allSubmitted = players.every(p => p.listSubmitted);
    if (!allSubmitted) return;

    // Only host triggers the transition to prevent race conditions
    if (this.isHost && room.meta.status === "entry") {
      // Shuffle turn order
      const playerIds = players.map(p => p.id);
      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }

      const updates = {
        "meta/status": "playing",
        "game/turnOrder": playerIds,
        "game/currentTurnIndex": 0,
        "game/activePlayerId": playerIds[0],
        "game/round": 1,
        "game/lastAction": {
          text: `Match started! ${room.players[playerIds[0]].name}'s turn to guess.`,
          timestamp: Date.now()
        }
      };

      await db.update(`rooms/${this.currentRoomCode}`, updates);
    }
  }

  // ==========================================================================
  // VIEW 4: MAIN GAME PHASE LOGIC
  // ==========================================================================

  renderMainGame(room) {
    const game = room.game || {};
    const players = room.players || {};
    const turnOrder = game.turnOrder || [];
    const activePlayerId = game.activePlayerId || turnOrder[game.currentTurnIndex || 0];
    const isMyTurn = (activePlayerId === this.myPlayerId);

    // Live Action Ticker
    if (game.lastAction && game.lastAction.text) {
      this.actionFeedText.textContent = game.lastAction.text;
    }
    this.gameRoundIndicator.textContent = `ROUND ${game.round || 1}`;

    // Turn Order pills
    this.turnOrderContainer.innerHTML = "";
    turnOrder.forEach(pid => {
      const p = players[pid];
      if (!p) return;
      const pill = document.createElement("div");
      const isActive = (pid === activePlayerId);
      pill.className = `turn-pill ${isActive ? 'is-active' : ''}`;
      pill.textContent = p.name + (pid === this.myPlayerId ? ' (You)' : '');
      this.turnOrderContainer.appendChild(pill);
    });

    // Check for Active Layer 3 Confirmation Modal
    this.handleConfirmationState(room);

    // Active vs Passive Turn Control
    if (isMyTurn) {
      this.activeTurnControl.classList.remove("hidden");
      this.passiveTurnBanner.classList.add("hidden");
      this.renderTargetPlayerSelector(room);
    } else {
      this.activeTurnControl.classList.add("hidden");
      this.passiveTurnBanner.classList.remove("hidden");
      const activeP = players[activePlayerId];
      this.passiveActivePlayerName.textContent = activeP ? activeP.name : "Player";
    }

    // Opponent tabs bar & Board slots
    this.renderPlayerTabs(room);
    this.renderBoardSlots(room);

    // Live standings
    this.renderStandings(room);

    // Check if match should end
    this.checkGameCompletion(room);
  }

  // --------------------------------------------------------------------------
  // TARGET SELECTOR & GUESS CONTROLS
  // --------------------------------------------------------------------------

  renderTargetPlayerSelector(room) {
    const players = room.players || {};
    const lists = room.lists || {};
    const opponentIds = Object.keys(players).filter(id => id !== this.myPlayerId);

    // Find if current target selection is valid
    if (this.selectedTargetPlayerId && this.isPlayerListCompleted(this.selectedTargetPlayerId, lists)) {
      this.selectedTargetPlayerId = null;
    }

    // Auto-select first valid opponent if none selected
    if (!this.selectedTargetPlayerId) {
      const firstValid = opponentIds.find(id => !this.isPlayerListCompleted(id, lists));
      if (firstValid) {
        this.selectedTargetPlayerId = firstValid;
      }
    }

    this.targetPlayerGrid.innerHTML = "";
    opponentIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      const isCompleted = this.isPlayerListCompleted(id, lists);
      const isSelected = (id === this.selectedTargetPlayerId);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `target-btn ${isSelected ? 'selected' : ''} ${isCompleted ? 'disabled' : ''}`;
      btn.innerHTML = `
        <span>${this.escapeHtml(p.name)}</span>
        <span class="mono" style="font-size: 11px;">${isCompleted ? 'DONE' : 'TARGET'}</span>
      `;

      if (!isCompleted) {
        btn.addEventListener("click", () => {
          this.selectedTargetPlayerId = id;
          this.viewingPlayerId = id;
          this.isViewingMySecretList = false;
          this.btnToggleMyList.classList.remove("active");
          this.renderTargetPlayerSelector(room);
          this.renderPlayerTabs(room);
          this.renderBoardSlots(room);
        });
      }

      this.targetPlayerGrid.appendChild(btn);
    });

    this.updateSubmitButtonState();
  }

  isPlayerListCompleted(playerId, lists) {
    const playerList = lists[playerId];
    if (!playerList) return false;
    for (let r = 1; r <= 10; r++) {
      if (!playerList[r] || !playerList[r].revealed) {
        return false;
      }
    }
    return true;
  }

  handleTurnGuessInput(val) {
    this.updateSubmitButtonState();
    if (!val || val.trim().length === 0) {
      this.turnAutocompleteDropdown.classList.remove("open");
      this.turnAutocompleteDropdown.innerHTML = "";
      return;
    }

    const matches = searchSuggestions(this.category, val, 6);
    if (matches.length === 0) {
      this.turnAutocompleteDropdown.classList.remove("open");
      this.turnAutocompleteDropdown.innerHTML = "";
      return;
    }

    this.turnAutocompleteDropdown.innerHTML = "";
    matches.forEach(m => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <span class="suggestion-name">${this.escapeHtml(m.name)}</span>
        <span class="suggestion-ar">${this.escapeHtml(m.ar || "")}</span>
      `;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.inputTurnGuess.value = m.name;
        this.turnAutocompleteDropdown.classList.remove("open");
        this.turnAutocompleteDropdown.innerHTML = "";
        this.updateSubmitButtonState();
      });
      this.turnAutocompleteDropdown.appendChild(item);
    });

    this.turnAutocompleteDropdown.classList.add("open");
  }

  updateSubmitButtonState() {
    const guessText = this.inputTurnGuess.value.trim();
    const hasTarget = !!this.selectedTargetPlayerId;
    this.btnSubmitGuess.disabled = !hasTarget || guessText.length === 0;
  }

  // --------------------------------------------------------------------------
  // 3-LAYER VERIFICATION ENGINE & TURN ADVANCEMENT
  // --------------------------------------------------------------------------

  async handleSubmitTurnGuess() {
    const targetPlayerId = this.selectedTargetPlayerId;
    const guessText = this.inputTurnGuess.value.trim();

    if (!targetPlayerId || !guessText) return;

    // Reset input
    this.inputTurnGuess.value = "";
    this.turnAutocompleteDropdown.classList.remove("open");
    this.btnSubmitGuess.disabled = true;

    const targetList = this.roomData.lists ? this.roomData.lists[targetPlayerId] : null;
    const targetPlayer = this.roomData.players[targetPlayerId];
    const myPlayer = this.roomData.players[this.myPlayerId];

    if (!targetList || !targetPlayer) return;

    // Filter unrevealed slots on target's list
    const unrevealedSlots = [];
    for (let r = 1; r <= 10; r++) {
      if (targetList[r] && !targetList[r].revealed) {
        unrevealedSlots.push({ rank: r, ...targetList[r] });
      }
    }

    const normGuess = normalizeText(guessText);

    // ========================================================================
    // LAYER 1: EXACT NORMALIZED MATCH
    // ========================================================================
    let exactMatch = null;
    for (const slot of unrevealedSlots) {
      const normItem = normalizeText(slot.item);
      if (normGuess === normItem) {
        exactMatch = slot;
        break;
      }
    }

    if (exactMatch) {
      await this.applyCorrectGuess(exactMatch, targetPlayerId, targetPlayer.name, myPlayer);
      return;
    }

    // ========================================================================
    // LAYER 2: FUZZY LEVENSHTEIN MATCH
    // Requirement: Levenshtein distance <= 2 for words > 5 chars, <= 1 for 4-5 chars
    // ========================================================================
    let confidentFuzzyMatch = null;
    let matchCount = 0;

    for (const slot of unrevealedSlots) {
      const normItem = normalizeText(slot.item);
      const dist = getLevenshteinDistance(normGuess, normItem);
      const minLen = Math.min(normGuess.length, normItem.length);

      let isFuzzy = false;
      if (minLen > 5 && dist <= 2) {
        isFuzzy = true;
      } else if (minLen >= 4 && minLen <= 5 && dist <= 1) {
        isFuzzy = true;
      }

      if (isFuzzy) {
        confidentFuzzyMatch = slot;
        matchCount++;
      }
    }

    // If exactly one confident fuzzy candidate matches
    if (confidentFuzzyMatch && matchCount === 1) {
      await this.applyCorrectGuess(confidentFuzzyMatch, targetPlayerId, targetPlayer.name, myPlayer);
      return;
    }

    // ========================================================================
    // LAYER 3: LIVE TARGET CONFIRMATION POPUP (FALLBACK)
    // No exact auto-match. Prompt target player with live modal.
    // ========================================================================
    const confirmationData = {
      active: true,
      fromPlayerId: this.myPlayerId,
      fromPlayerName: myPlayer.name,
      toPlayerId: targetPlayerId,
      toPlayerName: targetPlayer.name,
      guessText: guessText,
      createdAt: Date.now()
    };

    await db.update(`rooms/${this.currentRoomCode}/game`, {
      confirmation: confirmationData
    });
  }

  async applyCorrectGuess(slot, targetPlayerId, targetPlayerName, guesserPlayer) {
    const pointsAwarded = slot.points;
    const newGuesserPoints = (guesserPlayer.points || 0) + pointsAwarded;

    const actionText = `${guesserPlayer.name} guessed '${slot.item}' on ${targetPlayerName}'s list (+${pointsAwarded} pts)`;

    const updates = {};
    updates[`lists/${targetPlayerId}/${slot.rank}/revealed`] = true;
    updates[`lists/${targetPlayerId}/${slot.rank}/guessedBy`] = guesserPlayer.name;
    updates[`players/${this.myPlayerId}/points`] = newGuesserPoints;
    updates[`game/lastAction`] = {
      text: actionText,
      timestamp: Date.now()
    };

    // Check if target's list is completely revealed
    const targetList = this.roomData.lists[targetPlayerId];
    let remaining = 0;
    for (let r = 1; r <= 10; r++) {
      if (r !== slot.rank && targetList[r] && !targetList[r].revealed) {
        remaining++;
      }
    }
    if (remaining === 0) {
      updates[`players/${targetPlayerId}/targetCompleted`] = true;
    }

    await db.update(`rooms/${this.currentRoomCode}`, updates);
    await this.advanceTurn();
  }

  async advanceTurn() {
    const game = this.roomData.game;
    const turnOrder = game.turnOrder || [];
    let nextIndex = (game.currentTurnIndex + 1) % turnOrder.length;
    let nextRound = game.round || 1;

    if (nextIndex === 0) {
      nextRound += 1;
    }

    // Edge case: if a player has unrevealed items left but all other players have 100% completed lists,
    // that sole player cannot target anyone, so their turn is skipped.
    const activeCandidateId = turnOrder[nextIndex];
    if (this.isSoleRemainingPlayer(activeCandidateId, this.roomData)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
    }

    const nextActivePlayerId = turnOrder[nextIndex];

    await db.update(`rooms/${this.currentRoomCode}/game`, {
      currentTurnIndex: nextIndex,
      activePlayerId: nextActivePlayerId,
      round: nextRound,
      confirmation: null
    });
  }

  isSoleRemainingPlayer(playerId, room) {
    const lists = room.lists || {};
    const playerIds = Object.keys(room.players || {});
    // Check if all OTHER players have their lists 100% completed
    const otherPlayers = playerIds.filter(id => id !== playerId);
    const allOthersCompleted = otherPlayers.every(id => this.isPlayerListCompleted(id, lists));
    return allOthersCompleted;
  }

  // --------------------------------------------------------------------------
  // LAYER 3 CONFIRMATION MODAL HANDLERS
  // --------------------------------------------------------------------------

  handleConfirmationState(room) {
    const confirmation = room.game ? room.game.confirmation : null;

    if (!confirmation || !confirmation.active) {
      this.modalConfirmation.classList.remove("open");
      this.waitingConfirmationBackdrop.classList.remove("open");
      return;
    }

    const isTargetPlayer = (confirmation.toPlayerId === this.myPlayerId);

    if (isTargetPlayer) {
      // Show confirmation popup to target player
      this.waitingConfirmationBackdrop.classList.remove("open");
      this.confirmGuesserName.textContent = confirmation.fromPlayerName;
      this.confirmGuessText.textContent = `"${confirmation.guessText}"`;

      // Render remaining unrevealed slots as clickable buttons
      this.confirmSlotsContainer.innerHTML = "";
      const myList = room.lists ? room.lists[this.myPlayerId] : {};

      for (let r = 1; r <= 10; r++) {
        const slot = myList[r];
        if (slot && !slot.revealed) {
          const btn = document.createElement("button");
          btn.className = "confirm-slot-btn";
          btn.innerHTML = `
            <span><strong>#${r}</strong> - ${this.escapeHtml(slot.item)}</span>
            <span class="slot-meta">+${r} ${r === 1 ? 'pt' : 'pts'}</span>
          `;
          btn.addEventListener("click", () => {
            this.handleConfirmResponse(r);
          });
          this.confirmSlotsContainer.appendChild(btn);
        }
      }

      this.modalConfirmation.classList.add("open");
    } else {
      // Spectator / Guesser waiting screen
      this.modalConfirmation.classList.remove("open");
      this.specTargetName.textContent = confirmation.toPlayerName;
      this.specGuessText.textContent = `"${confirmation.guessText}"`;
      this.waitingConfirmationBackdrop.classList.add("open");
    }
  }

  async handleConfirmResponse(confirmedRank) {
    const confirmation = this.roomData.game ? this.roomData.game.confirmation : null;
    if (!confirmation || confirmation.toPlayerId !== this.myPlayerId) return;

    this.modalConfirmation.classList.remove("open");

    const guesserId = confirmation.fromPlayerId;
    const guesserPlayer = this.roomData.players[guesserId];

    if (confirmedRank !== null) {
      // Correct guess confirmed for slot #confirmedRank
      const slot = this.roomData.lists[this.myPlayerId][confirmedRank];
      const points = slot.points;
      const newPoints = (guesserPlayer.points || 0) + points;
      const actionText = `${confirmation.fromPlayerName} guessed '${slot.item}' on ${confirmation.toPlayerName}'s list (+${points} pts)`;

      const updates = {};
      updates[`lists/${this.myPlayerId}/${confirmedRank}/revealed`] = true;
      updates[`lists/${this.myPlayerId}/${confirmedRank}/guessedBy`] = confirmation.fromPlayerName;
      updates[`players/${guesserId}/points`] = newPoints;
      updates[`game/lastAction`] = {
        text: actionText,
        timestamp: Date.now()
      };

      // Check if my list is now complete
      let remaining = 0;
      for (let r = 1; r <= 10; r++) {
        if (r !== confirmedRank && !this.roomData.lists[this.myPlayerId][r].revealed) {
          remaining++;
        }
      }
      if (remaining === 0) {
        updates[`players/${this.myPlayerId}/targetCompleted`] = true;
      }

      await db.update(`rooms/${this.currentRoomCode}`, updates);
    } else {
      // Missed guess ("Not on my list")
      const actionText = `${confirmation.fromPlayerName} missed on ${confirmation.toPlayerName}'s list (0 pts)`;
      await db.update(`rooms/${this.currentRoomCode}/game`, {
        lastAction: {
          text: actionText,
          timestamp: Date.now()
        }
      });
    }

    // Advance turn and clear confirmation
    await this.advanceTurn();
  }

  // --------------------------------------------------------------------------
  // BOARD DISPLAY & MY LIST TOGGLE
  // --------------------------------------------------------------------------

  renderPlayerTabs(room) {
    const players = room.players || {};
    const opponentIds = Object.keys(players).filter(id => id !== this.myPlayerId);

    if (!this.viewingPlayerId && opponentIds.length > 0) {
      this.viewingPlayerId = opponentIds[0];
    }

    this.playerTabsBar.innerHTML = "";
    opponentIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      const isSelected = (!this.isViewingMySecretList && this.viewingPlayerId === id);
      const isCompleted = this.isPlayerListCompleted(id, room.lists || {});

      const tab = document.createElement("button");
      tab.className = `player-tab-btn ${isSelected ? 'active' : ''}`;
      tab.textContent = p.name + (isCompleted ? ' (Done)' : '');
      tab.addEventListener("click", () => {
        this.viewingPlayerId = id;
        this.isViewingMySecretList = false;
        this.btnToggleMyList.classList.remove("active");
        this.renderPlayerTabs(room);
        this.renderBoardSlots(room);
      });
      this.playerTabsBar.appendChild(tab);
    });
  }

  toggleMySecretList() {
    this.isViewingMySecretList = !this.isViewingMySecretList;
    if (this.isViewingMySecretList) {
      this.btnToggleMyList.classList.add("active");
      this.viewingPlayerId = this.myPlayerId;
    } else {
      this.btnToggleMyList.classList.remove("active");
      const opponentIds = Object.keys(this.roomData.players || {}).filter(id => id !== this.myPlayerId);
      this.viewingPlayerId = opponentIds[0] || this.myPlayerId;
    }
    this.renderPlayerTabs(this.roomData);
    this.renderBoardSlots(this.roomData);
  }

  renderBoardSlots(room) {
    const targetId = this.isViewingMySecretList ? this.myPlayerId : this.viewingPlayerId;
    const player = room.players ? room.players[targetId] : null;
    const list = room.lists ? room.lists[targetId] : null;

    if (!player || !list) return;

    // Header info
    if (this.isViewingMySecretList) {
      this.selectedBoardPlayerName.textContent = "My Secret List";
      this.selectedBoardScoreTag.textContent = `MY SCORE: ${player.points || 0} PTS`;
    } else {
      const isKickable = this.isHost && targetId !== this.myPlayerId;
      this.selectedBoardPlayerName.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${this.escapeHtml(player.name)}'s List</span>
          ${isKickable ? `<button class="btn btn-kick" id="btn-kick-viewed-player">KICK</button>` : ''}
        </div>
      `;
      this.selectedBoardScoreTag.textContent = `SCORE: ${player.points || 0} PTS`;

      if (isKickable) {
        const kickViewedBtn = document.getElementById("btn-kick-viewed-player");
        if (kickViewedBtn) {
          kickViewedBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleKickPlayer(targetId, player.name);
          });
        }
      }
    }

    let hiddenCount = 0;
    for (let r = 1; r <= 10; r++) {
      if (list[r] && !list[r].revealed) hiddenCount++;
    }

    this.selectedBoardStatusBadge.textContent = `${hiddenCount} / 10 HIDDEN`;
    this.selectedBoardStatusBadge.className = `badge ${hiddenCount === 0 ? 'badge-success' : ''}`;

    // Render 10 slots
    this.boardSlotsList.innerHTML = "";
    const myHints = this.roomData?.players?.[this.myPlayerId]?.hints || {};
    const targetPlayer = room.players ? room.players[targetId] : null;
    const targetHints = targetPlayer?.hints || {};

    for (let r = 10; r >= 1; r--) {
      const slot = list[r] || { item: "", revealed: false, points: r };
      const itemEl = document.createElement("div");

      // For my own secret list: always show what I wrote, but distinguish whether it was revealed publicly
      if (this.isViewingMySecretList) {
        itemEl.className = `board-slot-item ${slot.revealed ? 'revealed' : ''}`;
        const hint = myHints[r];
        const hintBadge = hint ? `<span class="board-slot-hint"><span class="hint-badge-tag">HINT</span> ${this.escapeHtml(hint.text)}</span>` : '';
        const giveHintBtn = !slot.revealed
          ? `<button type="button" class="btn btn-sm ${hint ? '' : 'btn-primary'} btn-hint btn-board-hint" data-rank="${r}">${hint ? 'EDIT HINT' : 'GIVE HINT'}</button>`
          : '';

        itemEl.innerHTML = `
          <div class="board-slot-rank">#${r}</div>
          <div class="board-slot-content">
            <span class="board-slot-name">${this.escapeHtml(slot.item)}</span>
            <span class="board-slot-by text-secondary">${slot.revealed ? `Revealed (Guessed by ${this.escapeHtml(slot.guessedBy || "Someone")})` : 'Private to you'}</span>
            ${hintBadge}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${giveHintBtn}
            <div class="board-slot-pts">${r} pts</div>
          </div>
        `;

        const btn = itemEl.querySelector(".btn-board-hint");
        if (btn) {
          btn.addEventListener("click", () => this.openGiveHintModal(r, slot.item));
        }
      } else {
        // Opponent's list
        if (slot.revealed) {
          itemEl.className = "board-slot-item revealed";
          itemEl.innerHTML = `
            <div class="board-slot-rank">#${r}</div>
            <div class="board-slot-content">
              <span class="board-slot-name">${this.escapeHtml(slot.item)}</span>
              <span class="board-slot-by">Guessed by ${this.escapeHtml(slot.guessedBy || "Someone")}</span>
            </div>
            <div class="board-slot-pts">+${r} pts</div>
          `;
        } else {
          itemEl.className = "board-slot-item locked";
          const hint = targetHints[r];
          const hintHtml = hint
            ? `<div class="board-slot-hint"><span class="hint-badge-tag">HINT</span> ${this.escapeHtml(hint.text)}</div>`
            : '';

          itemEl.innerHTML = `
            <div class="board-slot-rank">#${r}</div>
            <div class="board-slot-content">
              <span class="board-slot-name">[ HIDDEN - ${r} PTS ]</span>
              ${hintHtml}
            </div>
            <div class="board-slot-pts">${r} pts</div>
          `;
        }
      }

      this.boardSlotsList.appendChild(itemEl);
    }
  }

  renderStandings(room) {
    const players = Object.values(room.players || {});
    players.sort((a, b) => (b.points || 0) - (a.points || 0));

    this.liveStandingsGrid.innerHTML = "";
    players.forEach(p => {
      const badge = document.createElement("div");
      const isTurn = (p.id === room.game?.activePlayerId);
      const isKickable = this.isHost && p.id !== this.myPlayerId;

      badge.className = `standing-badge ${isTurn ? 'active-turn-standing' : ''}`;
      badge.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>${this.escapeHtml(p.name)} ${p.id === this.myPlayerId ? '(You)' : ''}</span>
          ${isKickable ? `<button class="btn btn-kick" data-kick-id="${p.id}">KICK</button>` : ''}
        </div>
        <span class="pts">${p.points || 0} pts</span>
      `;

      if (isKickable) {
        const kickBtn = badge.querySelector(`[data-kick-id="${p.id}"]`);
        if (kickBtn) {
          kickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleKickPlayer(p.id, p.name);
          });
        }
      }

      this.liveStandingsGrid.appendChild(badge);
    });
  }

  // --------------------------------------------------------------------------
  // GAME OVER & PODIUM LOGIC
  // --------------------------------------------------------------------------

  checkGameCompletion(room) {
    if (room.meta.status !== "playing") return;
    const players = Object.values(room.players || {});
    const lists = room.lists || {};

    // Condition: every player's list is 100% revealed OR only 1 player has unrevealed items left
    let uncompletedCount = 0;
    players.forEach(p => {
      if (!this.isPlayerListCompleted(p.id, lists)) {
        uncompletedCount++;
      }
    });

    if (uncompletedCount <= 1 && players.length >= 2) {
      if (this.isHost) {
        db.update(`rooms/${this.currentRoomCode}/meta`, { status: "game_over" });
      }
    }
  }

  renderGameOver(room) {
    const players = Object.values(room.players || {});
    players.sort((a, b) => (b.points || 0) - (a.points || 0));

    const winner = players[0];
    this.podiumWinnerName.textContent = winner ? `${winner.name} (${winner.points || 0} pts)` : "No Winner";

    // Final leaderboard
    this.finalLeaderboardList.innerHTML = "";
    players.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = `final-score-row ${idx === 0 ? 'rank-1' : ''}`;
      row.innerHTML = `
        <span class="rank-pos">#${idx + 1}</span>
        <span class="player-label">${this.escapeHtml(p.name)} ${p.id === this.myPlayerId ? '(You)' : ''}</span>
        <span class="score-value">${p.points || 0} PTS</span>
      `;
      this.finalLeaderboardList.appendChild(row);
    });

    // Full revealed lists for all players
    this.finalAllListsContainer.innerHTML = "";
    const lists = room.lists || {};
    players.forEach(p => {
      const pList = lists[p.id] || {};
      const card = document.createElement("div");
      card.className = "card";
      card.style.padding = "12px";

      let slotsHtml = "";
      for (let r = 1; r <= 10; r++) {
        const s = pList[r] || { item: "N/A" };
        slotsHtml += `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-subtle); font-size: 13px;">
            <span><strong class="mono">#${r}</strong> ${this.escapeHtml(s.item)}</span>
            <span class="mono text-secondary" style="font-size: 11px;">${r} pts ${s.guessedBy ? `(Guessed by ${s.guessedBy})` : '(Unguessed)'}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 8px;">${this.escapeHtml(p.name)}'s Top 10</div>
        <div>${slotsHtml}</div>
      `;
      this.finalAllListsContainer.appendChild(card);
    });

    // Play Again button (Host only)
    if (this.isHost) {
      this.btnPlayAgain.classList.remove("hidden");
      this.playAgainNote.textContent = "You are the Host. Click below to start a new match in this room.";
    } else {
      this.btnPlayAgain.classList.add("hidden");
      this.playAgainNote.textContent = "Waiting for the Host to start a new match...";
    }
  }

  async handlePlayAgain() {
    if (!this.isHost || !this.currentRoomCode) return;

    // Reset player scores and submission states, clear lists, return to lobby
    const updates = {
      "meta/status": "lobby",
      "game/round": 1,
      "game/turnOrder": [],
      "game/currentTurnIndex": 0,
      "game/activePlayerId": null,
      "game/confirmation": null,
      "game/lastAction": {
        text: "New match starting. Host is choosing category.",
        timestamp: Date.now()
      },
      "lists": {}
    };

    const players = this.roomData.players || {};
    Object.keys(players).forEach(pid => {
      updates[`players/${pid}/points`] = 0;
      updates[`players/${pid}/listSubmitted`] = false;
      updates[`players/${pid}/targetCompleted`] = false;
    });

    await db.update(`rooms/${this.currentRoomCode}`, updates);
  }

  // ==========================================================================
  // MY LIST OVERLAY DRAWER
  // ==========================================================================

  toggleMyListDrawer(forceOpen) {
    const shouldOpen = (typeof forceOpen === "boolean") 
      ? forceOpen 
      : !this.modalMyList.classList.contains("open");

    if (shouldOpen) {
      this.renderMyListDrawer();
      this.modalMyList.classList.add("open");
      this.btnHeaderMyList.classList.add("active");
    } else {
      this.modalMyList.classList.remove("open");
      this.btnHeaderMyList.classList.remove("active");
    }
  }

  renderMyListDrawer() {
    if (!this.roomData || !this.roomData.lists || !this.myPlayerId) return;
    const myList = this.roomData.lists[this.myPlayerId] || {};
    const myHints = this.roomData.players?.[this.myPlayerId]?.hints || {};

    this.myListDrawerSlots.innerHTML = "";
    for (let r = 1; r <= 10; r++) {
      const slot = myList[r] || { item: "N/A", revealed: false, points: r };
      const itemEl = document.createElement("div");
      itemEl.className = `my-list-slot-item ${slot.revealed ? 'revealed' : ''}`;

      const hint = myHints[r];
      let actionOrHint = "";
      if (slot.revealed) {
        actionOrHint = `<span class="badge badge-success">GUESSED BY ${this.escapeHtml(slot.guessedBy || "Opponent")} (+${slot.points || r} PTS)</span>`;
      } else {
        const hintBadge = hint 
          ? `<span class="my-list-hint-tag">HINT: ${this.escapeHtml(hint.text)}</span>` 
          : `<span class="badge">[ HIDDEN - ${r} PTS ]</span>`;
        const hintBtn = `<button type="button" class="btn btn-sm ${hint ? '' : 'btn-primary'} btn-hint btn-drawer-hint" data-rank="${r}">${hint ? 'EDIT HINT' : 'GIVE HINT'}</button>`;
        actionOrHint = `<div style="display: flex; align-items: center; gap: 6px;">${hintBadge}${hintBtn}</div>`;
      }

      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="mono" style="font-weight: 800; color: var(--accent);">#${r}</span>
          <span style="font-weight: 600;">${this.escapeHtml(slot.item)}</span>
        </div>
        <div>${actionOrHint}</div>
      `;

      const btn = itemEl.querySelector(".btn-drawer-hint");
      if (btn) {
        btn.addEventListener("click", () => this.openGiveHintModal(r, slot.item));
      }

      this.myListDrawerSlots.appendChild(itemEl);
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}

// Instantiate game on page load
window.addEventListener("DOMContentLoaded", () => {
  window.gameApp = new GameController();
});
