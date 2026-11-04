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

  async registerSoloLobbyDisconnect(roomCode) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, onDisconnect } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        const roomRef = ref(this.fbDb, `rooms/${roomCode}`);
        await onDisconnect(roomRef).remove();
      } catch (err) {}
    }
  }

  async cancelSoloLobbyDisconnect(roomCode) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, onDisconnect } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        const roomRef = ref(this.fbDb, `rooms/${roomCode}`);
        await onDisconnect(roomRef).cancel();
      } catch (err) {}
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
        const roomRef = ref(this.fbDb, `rooms/${roomCode}`);
        await onDisconnect(roomRef).cancel();
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

  async off(path) {
    await this.initPromise;
    if (this.isFirebaseReady && this.fbDb) {
      try {
        const { ref, off } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        off(ref(this.fbDb, path));
      } catch (err) {}
    }
    if (this.listeners.has(path)) {
      this.listeners.delete(path);
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
    this.selectedTargetId = null;
    this.selectedTargetPlayerId = null;
    this.viewingPlayerId = null; // board viewing
    this.isViewingMySecretList = false;
    this.category = "singers";
    this.activeHintTargetSlot = null;
    this.seenHints = new Set();
    this.connectedTimestamp = Date.now();
    this.pendingConfirmCallback = null;
    this.customCategoryAutoSaveTimeout = null;

    // Floating Live Event Toast
    this.toastDismissTimeout = null;
    this.toastFadeTimeout = null;
    this.lastSeenActionTimestamp = Date.now() - 3000;

    // Hints Hub and Hint Request state
    this.activeHintHubTab = "request";
    this.hintRequestOpponentId = null;
    this.hintRequestSlot = "any";
    this.isRespondingToHintRequest = false;
    this.requestedHintSlot = null;
    this.pendingIncomingHintRequest = null;
    this.lastHandledHintRequestTimestamp = 0;
    this.isLocalHintResponse = false;
    this.localHintOriginPlayerId = null;
    this.pendingLocalHintRequest = null;

    // 1-Device Pass & Play (Local Multiplayer) state
    this.isLocalMode = false;
    this.localMatch = null;
    this.localPlayerCount = 2;
    this.localCategory = "singers";
    this.localCustomCategory = "";
    this.localCurrentEntryIndex = 0;
    this.localCurtainProceedCallback = null;
    this.localPendingVerify = null;
    this.localRevealConfirmCallback = null;

    this.cacheDomElements();
    this.bindEvents();
    this.initAppRouting();
    this.startLivenessCheck();
  }

  cacheDomElements() {
    // Views
    this.views = {
      home: document.getElementById("view-home"),
      lobby: document.getElementById("view-lobby"),
      entry: document.getElementById("view-entry"),
      game: document.getElementById("view-game"),
      gameOver: document.getElementById("view-game-over"),
      game_over: document.getElementById("view-game-over")
    };

    // Header & Floating Live Event Toast
    this.headerRoomStack = document.getElementById("header-room-stack");
    this.headerRoomTag = document.getElementById("header-room-tag");
    this.headerRoomCode = document.getElementById("header-room-code");
    this.btnHeaderHints = document.getElementById("btn-header-hints");
    this.btnHeaderMyList = document.getElementById("btn-header-my-list");
    this.btnHeaderLeave = document.getElementById("btn-header-leave");
    this.systemAlertBanner = document.getElementById("floating-notification-toast") || document.getElementById("system-alert-banner");
    this.systemAlertText = document.getElementById("floating-toast-text") || document.getElementById("system-alert-text");
    this.floatingToastIcon = document.getElementById("floating-toast-icon");
    this.floatingToastProgress = document.getElementById("floating-toast-progress");
    this.btnCloseAlert = document.getElementById("btn-floating-toast-close") || document.getElementById("btn-close-alert");

    // Hints Hub Modal and Tabs
    this.modalHintsHub = document.getElementById("modal-hints-hub");
    this.hintsHubSlotsList = document.getElementById("hints-hub-slots-list");
    this.btnCloseHintsHub = document.getElementById("btn-close-hints-hub");
    this.btnDismissHintsHub = document.getElementById("btn-dismiss-hints-hub");
    this.btnHintsCancelMind = document.getElementById("btn-hints-cancel-mind");
    this.hintsTabBar = document.getElementById("hints-tab-bar");
    this.btnTabHintRequest = document.getElementById("btn-tab-hint-request");
    this.btnTabHintGive = document.getElementById("btn-tab-hint-give");
    this.hintsTabRequestPane = document.getElementById("hints-tab-request-pane");
    this.hintsTabGivePane = document.getElementById("hints-tab-give-pane");
    this.hintRequestOpponentsGrid = document.getElementById("hint-request-opponents-grid");
    this.hintRequestSlotsGrid = document.getElementById("hint-request-slots-grid");
    this.btnSendHintRequest = document.getElementById("btn-send-hint-request");
    this.hintsHubStatusBadge = document.getElementById("hints-hub-status-badge");
    this.hintsHubTagBadge = document.getElementById("hints-hub-tag-badge");
    this.hintsHubTitle = document.getElementById("hints-hub-title");

    // Incoming Hint Request Modal (Online Multiplayer)
    this.modalIncomingHintRequest = document.getElementById("modal-incoming-hint-request");
    this.incomingHintRequestTitle = document.getElementById("incoming-hint-request-title");
    this.incomingHintRequestDesc = document.getElementById("incoming-hint-request-desc");
    this.btnAcceptHintRequest = document.getElementById("btn-accept-hint-request");
    this.btnDeclineHintRequest = document.getElementById("btn-decline-hint-request");

    // Local Pass & Play Hint Request Modal (1-Device Mode)
    this.modalLocalHintRequest = document.getElementById("modal-local-hint-request");
    this.localHintRequestTitle = document.getElementById("local-hint-request-title");
    this.localHintRequestDesc = document.getElementById("local-hint-request-desc");
    this.btnLocalAcceptHint = document.getElementById("btn-local-accept-hint");
    this.btnLocalDeclineHint = document.getElementById("btn-local-decline-hint");

    // Reusable Sharp Confirmation Modal
    this.modalConfirm = document.getElementById("modal-confirm");
    this.confirmModalTitle = document.getElementById("confirm-modal-title");
    this.confirmModalMessage = document.getElementById("confirm-modal-message");
    this.btnModalCancel = document.getElementById("btn-modal-cancel");
    this.btnModalConfirmAction = document.getElementById("btn-modal-confirm-action");
    this.btnCloseConfirmModal = document.getElementById("btn-close-confirm-modal");

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
    this.customCategoryBox = document.getElementById("custom-category-box");
    this.inputCustomCategoryTitle = document.getElementById("input-custom-category-title");
    this.btnSaveCustomCategory = document.getElementById("btn-save-custom-category");
    this.customCategoryStatus = document.getElementById("custom-category-status");
    this.customCategoryDisplayNote = document.getElementById("custom-category-display-note");
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
    this.btnHostSkipTurnBar = document.getElementById("btn-host-skip-turn-bar");
    this.activeTurnControl = document.getElementById("active-turn-control");
    this.activeTurnControlTitle = document.getElementById("active-turn-control-title");
    this.btnActiveSkipTurn = document.getElementById("btn-active-skip-turn");
    this.passiveTurnBanner = document.getElementById("passive-turn-banner");
    this.passiveActivePlayerName = document.getElementById("passive-active-player-name");
    this.btnHostSkipTurn = document.getElementById("btn-host-skip-turn");
    this.targetPlayerGrid = document.getElementById("target-player-grid");
    this.targetMissedGuessesBox = document.getElementById("target-missed-guesses-box");
    this.targetMissedGuessesList = document.getElementById("target-missed-guesses-list");
    this.inputTurnGuess = document.getElementById("input-turn-guess");
    this.btnSubmitGuess = document.getElementById("btn-submit-guess");
    this.turnAutocompleteDropdown = document.getElementById("turn-autocomplete-dropdown");
    this.playerTabsBar = document.getElementById("player-tabs-bar");
    this.btnToggleMyList = document.getElementById("btn-toggle-my-list");
    this.selectedBoardPlayerName = document.getElementById("selected-board-player-name");
    this.selectedBoardStatusBadge = document.getElementById("selected-board-status-badge");
    this.selectedBoardScoreTag = document.getElementById("selected-board-score-tag");
    this.boardMissedGuessesBox = document.getElementById("board-missed-guesses-box");
    this.boardMissedGuessesList = document.getElementById("board-missed-guesses-list");
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
    this.pauseOverlayTitle = document.getElementById("pause-overlay-title");
    this.pauseOverlayMessage = document.getElementById("pause-overlay-message");
    this.pauseOverlaySubtitle = document.getElementById("pause-overlay-subtitle");
    this.pauseDisconnectedNames = document.getElementById("pause-disconnected-names");
    this.pauseHostActions = document.getElementById("pause-host-actions");
    this.pauseKickButtonsContainer = document.getElementById("pause-kick-buttons-container");
    this.btnPauseLeaveRoom = document.getElementById("btn-pause-leave-room");

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

    // Mode Selector Tabs & Panels (Online vs 1-Device Pass & Play)
    this.tabModeOnline = document.getElementById("tab-mode-online");
    this.tabModeLocal = document.getElementById("tab-mode-local");
    this.panelModeOnline = document.getElementById("panel-mode-online");
    this.panelModeLocal = document.getElementById("panel-mode-local");

    // 1-Device Setup Controls
    this.localReconnectBox = document.getElementById("local-reconnect-box");
    this.localReconnectInfo = document.getElementById("local-reconnect-info");
    this.btnLocalResume = document.getElementById("btn-local-resume");
    this.btnLocalDiscard = document.getElementById("btn-local-discard");
    this.btnLocalCountMinus = document.getElementById("btn-local-count-minus");
    this.btnLocalCountPlus = document.getElementById("btn-local-count-plus");
    this.localPlayerCountDisplay = document.getElementById("local-player-count-display");
    this.localPlayerNamesList = document.getElementById("local-player-names-list");
    this.localCategoryGrid = document.getElementById("local-category-grid");
    this.localCategoryBtns = document.querySelectorAll("#local-category-grid .category-option-btn");
    this.localCustomCategoryBox = document.getElementById("local-custom-category-box");
    this.inputLocalCustomCategoryTitle = document.getElementById("input-local-custom-category-title");
    this.localSetupErrorBanner = document.getElementById("local-setup-error-banner");
    this.btnStartLocalMatch = document.getElementById("btn-start-local-match");

    // Privacy Interstitial Curtain Modal
    this.modalPrivacyCurtain = document.getElementById("modal-privacy-curtain");
    this.privacyCurtainPlayerName = document.getElementById("privacy-curtain-player-name");
    this.privacyCurtainActionName = document.getElementById("privacy-curtain-action-name");
    this.btnPrivacyCurtainProceed = document.getElementById("btn-privacy-curtain-proceed");
    this.btnPrivacyCurtainCancel = document.getElementById("btn-privacy-curtain-cancel");

    // Local Protected Reveal Confirmation Modal (My List & Hints in Pass & Play)
    this.modalLocalRevealConfirm = document.getElementById("modal-local-reveal-confirm");
    this.localRevealConfirmTitle = document.getElementById("local-reveal-confirm-title") || document.getElementById("local-reveal-title");
    this.localRevealConfirmMessage = document.getElementById("local-reveal-confirm-message") || document.getElementById("local-reveal-msg");
    this.btnLocalRevealConfirm = document.getElementById("btn-local-reveal-confirm");
    this.btnLocalRevealCancel = document.getElementById("btn-local-reveal-cancel");

    // Local 3-Layer Verification Choice Modal (Option A Oral Check vs Option B Secret Pass)
    this.modalLocalVerifyChoice = document.getElementById("modal-local-verify-choice");
    this.localVerifyChoiceTargetBadge = document.getElementById("local-verify-choice-target-badge");
    this.localVerifyChoiceGuessText = document.getElementById("local-verify-choice-guess-text");
    this.localVerifyChoiceGuesserName = document.getElementById("local-verify-choice-guesser-name");
    this.localVerifyChoiceTargetName = document.getElementById("local-verify-choice-target-name");
    this.localVerifySecretTargetBtnLabel = document.getElementById("local-verify-secret-target-btn-label");
    this.btnLocalVerifySecretPass = document.getElementById("btn-local-verify-secret-pass");
    this.localVerifyOralRanksContainer = document.getElementById("local-verify-oral-ranks-container");
    this.btnLocalVerifyOralWrong = document.getElementById("btn-local-verify-oral-wrong");

    // Secret Target Slots Modal (Option B Secret Picker)
    this.modalLocalSecretTargetSlots = document.getElementById("modal-local-secret-target-slots");
    this.localSecretSlotsPlayerName = document.getElementById("local-secret-slots-player-name");
    this.localSecretSlotsGuessText = document.getElementById("local-secret-slots-guess-text");
    this.localSecretSlotsList = document.getElementById("local-secret-slots-list");
    this.btnLocalSecretSlotsWrong = document.getElementById("btn-local-secret-slots-wrong");
  }

  bindEvents() {
    // Navigation / Alerts & Floating Live Event Toast
    const onDismissToast = () => this.hideAlert();
    this.btnCloseAlert?.addEventListener("click", onDismissToast);
    this.btnCloseAlert?.addEventListener("pointerdown", onDismissToast);

    // Reusable Confirmation Modal
    this.btnModalCancel?.addEventListener("click", () => this.closeConfirmModal());
    this.btnCloseConfirmModal?.addEventListener("click", () => this.closeConfirmModal());
    this.modalConfirm?.addEventListener("click", (e) => {
      if (e.target === this.modalConfirm) this.closeConfirmModal();
    });
    this.btnModalConfirmAction?.addEventListener("click", () => {
      if (this.pendingConfirmCallback) {
        const cb = this.pendingConfirmCallback;
        this.closeConfirmModal();
        cb();
      }
    });

    // Immediate Leave handlers (pointerdown and mousedown to beat re-renders and mouse selection)
    const handleImmediateLeave = (e) => {
      const leaveTrigger = e.target.closest("#btn-header-leave, #btn-leave-room, #btn-pause-leave-room, #btn-return-home");
      if (leaveTrigger) {
        e.preventDefault();
        e.stopPropagation();
        if (this.isLocalMode) {
          this.handleLocalLeave();
        } else {
          this.executeLeaveRoom();
        }
      }
    };
    document.addEventListener("pointerdown", handleImmediateLeave, { capture: true });
    document.addEventListener("mousedown", handleImmediateLeave, { capture: true });
    document.addEventListener("click", handleImmediateLeave, { capture: true });

    if (this.btnHeaderLeave) {
      const onHeaderLeaveClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isLocalMode) {
          this.handleLocalLeave();
        } else {
          this.executeLeaveRoom();
        }
      };
      this.btnHeaderLeave?.addEventListener("pointerdown", onHeaderLeaveClick);
      this.btnHeaderLeave?.addEventListener("mousedown", onHeaderLeaveClick);
      this.btnHeaderLeave?.addEventListener("click", onHeaderLeaveClick);
    }

    // Window navigation sync
    window.addEventListener("hashchange", () => {
      const codeInUrl = this.getRoomCodeFromUrl();
      if (!codeInUrl && this.currentRoomCode && !this.isLocalMode) {
        this.executeLeaveRoom();
      }
    });

    // Hints Hub Header Button and Modal Toggle
    this.btnHeaderHints?.addEventListener("click", () => {
      this.openHintsHubModal("request");
    });
    this.btnCloseHintsHub?.addEventListener("click", () => this.closeHintsHubModal());
    this.btnDismissHintsHub?.addEventListener("click", () => this.closeHintsHubModal());
    this.btnHintsCancelMind?.addEventListener("click", () => this.handleCancelHintResponse());
    this.modalHintsHub?.addEventListener("click", (e) => {
      if (e.target === this.modalHintsHub) {
        this.closeHintsHubModal();
      }
    });

    // Hints Modal Tabs and Send Request
    this.btnTabHintRequest?.addEventListener("click", () => this.switchHintsTab("request"));
    this.btnTabHintGive?.addEventListener("click", () => this.switchHintsTab("give"));
    this.btnSendHintRequest?.addEventListener("click", () => this.handleSendHintRequest());

    // Online Incoming Hint Request Modal Buttons
    this.btnAcceptHintRequest?.addEventListener("click", () => this.handleAcceptIncomingHintRequest());
    this.btnDeclineHintRequest?.addEventListener("click", () => this.handleDeclineIncomingHintRequest());

    // Local Pass & Play Hint Request Modal Buttons
    this.btnLocalAcceptHint?.addEventListener("click", () => this.handleLocalAcceptHintRequest());
    this.btnLocalDeclineHint?.addEventListener("click", () => this.handleLocalDeclineHintRequest());

    // My List Drawer Toggle
    this.btnHeaderMyList?.addEventListener("click", () => {
      if (this.isLocalMode) {
        const activeName = this.localMatch?.players?.[this.myPlayerId]?.name || "Active Player";
        this.showLocalRevealConfirm(
          "PROTECTED LIST",
          `Show ${activeName}'s secret list? Make sure others aren't looking!`,
          () => this.toggleMyListDrawer(true)
        );
      } else {
        this.toggleMyListDrawer();
      }
    });
    this.btnCloseMyList?.addEventListener("click", () => this.toggleMyListDrawer(false));
    this.btnDismissMyList?.addEventListener("click", () => this.toggleMyListDrawer(false));
    this.modalMyList?.addEventListener("click", (e) => {
      if (e.target === this.modalMyList) {
        this.toggleMyListDrawer(false);
      }
    });

    // Window disconnect handler (sets connected to false, deletes solo lobby if host refreshes)
    window.addEventListener("beforeunload", () => {
      if (this.currentRoomCode) {
        const isLobby = !this.roomData || !this.roomData.meta || this.roomData.meta.status === "lobby" || this.roomData.meta.status === "waiting";
        const players = this.roomData ? Object.values(this.roomData.players || {}) : [];
        if (isLobby && players.length <= 1) {
          try {
            navigator.sendBeacon(`https://ta5mena-default-rtdb.firebaseio.com/rooms/${this.currentRoomCode}.json?x-http-method-override=DELETE`);
          } catch (e) {}
        }
        if (this.myPlayerId) {
          db.setPlayerConnected(this.currentRoomCode, this.myPlayerId, false);
        }
      }
    });

    // Give Hint Modal Events
    this.btnCloseGiveHint?.addEventListener("click", () => this.closeGiveHintModal());
    this.modalGiveHint?.addEventListener("click", (e) => {
      if (e.target === this.modalGiveHint) this.closeGiveHintModal();
    });
    this.btnHintFirstLetter?.addEventListener("click", () => this.submitFirstLetterHint());
    this.btnHintWordCount?.addEventListener("click", () => this.submitWordCountHint());
    this.btnSubmitCustomHint?.addEventListener("click", () => this.submitCustomHint());
    this.inputCustomHint?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitCustomHint();
    });

    // Home
    this.btnCreateRoom?.addEventListener("click", () => this.handleCreateRoom());
    this.btnJoinRoom?.addEventListener("click", () => this.handleJoinRoom());
    this.inputRoomCode?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    });
    this.inputRoomCode?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleJoinRoom();
      }
    });
    this.btnReconnect?.addEventListener("click", () => this.handleReconnect());
    this.btnDiscardSession?.addEventListener("click", () => this.discardSession());

    // Lobby & Header Room Code Copy vs Invite Link
    this.headerRoomTag?.addEventListener("click", () => this.copyRoomCodeOnly());
    this.lobbyRoomCode?.addEventListener("click", () => this.copyRoomCodeOnly());
    this.btnCopyCode?.addEventListener("click", () => this.copyRoomCodeOnly());
    this.btnShareLink?.addEventListener("click", () => this.copyRoomInviteLink());
    this.categoryOptionBtns?.forEach(btn => {
      btn?.addEventListener("click", (e) => {
        if (!this.isHost) return;
        const cat = e.currentTarget.dataset.category;
        this.setMatchCategory(cat);
      });
    });
    this.btnSaveCustomCategory?.addEventListener("click", () => this.saveCustomCategoryTitle());
    this.inputCustomCategoryTitle?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.saveCustomCategoryTitle();
    });
    this.inputCustomCategoryTitle?.addEventListener("input", () => this.autoSaveCustomCategory());
    this.btnStartMatch?.addEventListener("click", () => this.handleStartMatch());

    // Entry Phase
    this.btnRestoreLastList?.addEventListener("click", () => this.restoreLastList());
    this.btnSubmitList?.addEventListener("click", () => this.handleSubmitSecretList());

    // Game Phase Skip Turn (Immediate execution, bypass broken modals)
    const onHostSkip = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hostSkipTurn();
    };
    this.btnHostSkipTurn?.addEventListener("click", onHostSkip);
    this.btnHostSkipTurn?.addEventListener("pointerdown", onHostSkip);
    this.btnActiveSkipTurn?.addEventListener("click", onHostSkip);
    this.btnActiveSkipTurn?.addEventListener("pointerdown", onHostSkip);

    document.addEventListener("click", (e) => {
      const skipTrigger = e.target.closest("#btn-host-skip-turn, #btn-active-skip-turn");
      if (skipTrigger) {
        e.preventDefault();
        e.stopPropagation();
        this.hostSkipTurn();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      const skipTrigger = e.target.closest("#btn-host-skip-turn, #btn-active-skip-turn");
      if (skipTrigger) {
        e.preventDefault();
        e.stopPropagation();
        this.hostSkipTurn();
      }
    });

    this.inputTurnGuess?.addEventListener("input", (e) => this.handleTurnGuessInput(e.target.value));
    this.inputTurnGuess?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.btnSubmitGuess?.disabled) {
        this.handleSubmitTurnGuess();
      }
    });
    this.btnSubmitGuess?.addEventListener("click", () => this.handleSubmitTurnGuess());
    this.btnToggleMyList?.addEventListener("click", () => {
      if (this.isLocalMode) {
        const activeName = this.localMatch?.players?.[this.myPlayerId]?.name || "Active Player";
        this.showLocalRevealConfirm(
          "PROTECTED LIST",
          `Show ${activeName}'s secret list on the board? Make sure others aren't looking!`,
          () => this.toggleMySecretList()
        );
      } else {
        this.toggleMySecretList();
      }
    });

    // Confirmation Layer 3
    this.btnConfirmWrong?.addEventListener("click", () => this.handleConfirmResponse(null));

    // Game Over
    this.btnPlayAgain?.addEventListener("click", () => this.handlePlayAgain());
    this.btnReturnHome?.addEventListener("click", () => this.switchView("home"));

    // 1-Device Pass & Play Mode Selectors & Controls
    this.tabModeOnline?.addEventListener("click", () => this.switchHomeMode("online"));
    this.tabModeLocal?.addEventListener("click", () => this.switchHomeMode("local"));
    this.btnLocalCountMinus?.addEventListener("click", () => this.adjustLocalPlayerCount(-1));
    this.btnLocalCountPlus?.addEventListener("click", () => this.adjustLocalPlayerCount(1));
    this.localCategoryBtns?.forEach(btn => {
      btn?.addEventListener("click", (e) => this.selectLocalCategory(e.currentTarget.dataset.category));
    });
    this.btnStartLocalMatch?.addEventListener("click", () => this.startLocalMatch());
    this.btnLocalResume?.addEventListener("click", () => this.resumeLocalMatch());
    this.btnLocalDiscard?.addEventListener("click", () => this.discardLocalMatch());

    // Privacy Curtain Proceed & Cancel
    this.btnPrivacyCurtainProceed?.addEventListener("click", () => this.handlePrivacyCurtainProceed());
    this.btnPrivacyCurtainCancel?.addEventListener("click", () => {
      this.closePrivacyCurtain();
      this.executeLeaveLocalMatch();
    });

    // Local Reveal Confirm
    this.btnLocalRevealCancel?.addEventListener("click", () => this.closeLocalRevealConfirm());
    this.btnLocalRevealConfirm?.addEventListener("click", () => this.confirmLocalReveal());
    this.modalLocalRevealConfirm?.addEventListener("click", (e) => {
      if (e.target === this.modalLocalRevealConfirm) this.closeLocalRevealConfirm();
    });

    // Local 3-Layer Verification Choice Modal
    this.btnLocalVerifySecretPass?.addEventListener("click", () => this.openLocalSecretVerifyForTarget());
    this.btnLocalVerifyOralWrong?.addEventListener("click", () => this.handleLocalVerifyWrong());
    this.btnLocalSecretSlotsWrong?.addEventListener("click", () => this.handleLocalVerifyWrong());

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

    if (viewName === "home" || (!this.currentRoomCode && !this.isLocalMode)) {
      this.headerRoomStack?.classList.add("hidden");
      this.headerRoomTag?.classList.add("hidden");
      if (this.btnHeaderLeave) this.btnHeaderLeave.classList.add("hidden");
      if (this.btnHeaderHints) this.btnHeaderHints.classList.add("hidden");
      if (this.btnHeaderMyList) this.btnHeaderMyList.classList.add("hidden");
    } else {
      this.headerRoomStack?.classList.remove("hidden");
      this.headerRoomTag?.classList.remove("hidden");
      if (this.headerRoomCode) {
        this.headerRoomCode.textContent = this.isLocalMode ? "PASS & PLAY" : this.currentRoomCode;
      }
      if (this.btnHeaderLeave) this.btnHeaderLeave.classList.remove("hidden");
      if (this.btnHeaderHints) {
        if (viewName !== "game") {
          this.btnHeaderHints.classList.add("hidden");
        } else if (this.roomData) {
          this.updateMyListButtonVisibility(this.roomData);
        }
      }
      if (this.btnHeaderMyList) {
        if (this.isLocalMode && viewName === "game") {
          this.btnHeaderMyList.classList.remove("hidden");
        } else if (this.roomData) {
          this.updateMyListButtonVisibility(this.roomData);
        }
      }
    }
  }

  // ==========================================================================
  // FLOATING LIVE EVENT TOAST NOTIFICATION (10s AUTO-DISMISS)
  // ==========================================================================

  getToastIconSvg(type) {
    if (type === "success") {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#00E676" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === "danger") {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FF3B30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === "milestone") {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M6 4h12v7a6 6 0 0 1-12 0V4z"/></svg>`;
    } else if (type === "hint") {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>`;
    } else {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FF4D00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    }
  }

  showFloatingNotification(message, type = "general") {
    if (!message) return;
    if (this.toastDismissTimeout) clearTimeout(this.toastDismissTimeout);
    if (this.toastFadeTimeout) clearTimeout(this.toastFadeTimeout);

    const toast = this.systemAlertBanner;
    if (!toast) return;

    // Detect type if not explicit
    let resolvedType = type;
    const lower = message.toLowerCase();
    if (resolvedType === "general" || !resolvedType) {
      if (lower.includes("100% complete") || lower.includes("place)")) {
        resolvedType = "milestone";
      } else if (lower.includes("guessed '") || (lower.includes("guessed") && lower.includes("pts"))) {
        resolvedType = "success";
      } else if (lower.includes("missed") || lower.includes("not on my list")) {
        resolvedType = "danger";
      } else if (lower.includes("hint") || lower.includes("clue")) {
        resolvedType = "hint";
      } else if (lower.includes("skipped")) {
        resolvedType = "skip";
      }
    }

    // Reset and apply style class
    toast.className = "floating-toast-card";
    if (resolvedType === "success") {
      toast.classList.add("toast-success");
    } else if (resolvedType === "danger") {
      toast.classList.add("toast-danger");
    } else if (resolvedType === "milestone") {
      toast.classList.add("toast-milestone");
    } else {
      toast.classList.add("toast-general");
    }

    if (this.floatingToastIcon) {
      this.floatingToastIcon.innerHTML = this.getToastIconSvg(resolvedType);
    }
    if (this.systemAlertText) {
      this.systemAlertText.textContent = message;
    }
    if (this.btnCloseAlert && !this.btnCloseAlert.querySelector("svg")) {
      this.btnCloseAlert.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }

    // Restart the 10-second CSS shrinking progress bar animation
    const oldProgress = document.getElementById("floating-toast-progress");
    if (oldProgress) oldProgress.remove();
    const newProgress = document.createElement("div");
    newProgress.id = "floating-toast-progress";
    newProgress.className = "floating-toast-progress";
    toast.appendChild(newProgress);
    this.floatingToastProgress = newProgress;

    // Show toast
    toast.classList.remove("hidden");
    toast.classList.remove("toast-hiding");

    // 10-second auto-dismiss
    this.toastDismissTimeout = setTimeout(() => {
      this.dismissFloatingNotification();
    }, 10000);
  }

  dismissFloatingNotification() {
    if (this.toastDismissTimeout) clearTimeout(this.toastDismissTimeout);
    const toast = this.systemAlertBanner;
    if (!toast || toast.classList.contains("hidden")) return;

    toast.classList.add("toast-hiding");
    this.toastFadeTimeout = setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("toast-hiding");
    }, 300);
  }

  showAlert(message, type = "general") {
    this.showFloatingNotification(message, type);
  }

  hideAlert() {
    this.dismissFloatingNotification();
  }

  // ==========================================================================
  // PLACEMENT MILESTONE HELPERS
  // ==========================================================================

  getOrdinalPlace(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]} Place`;
  }

  getOrdinalBadge(n) {
    const s = ["TH", "ST", "ND", "RD"];
    const v = n % 100;
    return `FINISHED - ${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  checkAndRecordListCompletion(targetPlayerId, newlyRevealedRank, updates, baseActionText = "") {
    const targetList = this.roomData?.lists?.[targetPlayerId] || {};
    let remaining = 0;
    for (let r = 1; r <= 10; r++) {
      if (r !== newlyRevealedRank && targetList[r] && !targetList[r].revealed) {
        remaining++;
      }
    }

    const activePlayers = Object.values(this.roomData?.players || {}).filter(p => !p.left);
    const targetPlayer = this.roomData?.players?.[targetPlayerId];
    const targetName = targetPlayer?.name || "Player";

    if (remaining === 0) {
      updates[`players/${targetPlayerId}/targetCompleted`] = true;

      // 1v1 Head-to-Head Rule (Active Players === 2):
      // The first player to completely reveal the other player's Top 10 list (55 pts) immediately WINS!
      if (activePlayers.length === 2) {
        updates["meta/status"] = "game_over";
        const guesserName = this.myPlayerName || "Guesser";
        const winText = `${guesserName} finished ${targetName}'s list (55 pts) and WINS the match!`;
        updates["game/lastAction"] = {
          text: winText,
          type: "milestone",
          timestamp: Date.now()
        };
        return winText;
      }

      // 3+ Player Multi-Stage Race Rule:
      const currentFinished = this.roomData?.finishedOrder 
        ? (Array.isArray(this.roomData.finishedOrder) ? [...this.roomData.finishedOrder] : Object.values(this.roomData.finishedOrder))
        : [];

      if (!currentFinished.includes(targetPlayerId)) {
        currentFinished.push(targetPlayerId);
        updates["finishedOrder"] = currentFinished;

        const placeNum = currentFinished.length;
        const placeText = this.getOrdinalPlace(placeNum);
        const milestoneText = `${targetName}'s list is 100% complete (${placeText})! The game continues until everyone finishes!`;

        updates["game/lastAction"] = {
          text: milestoneText,
          type: "milestone",
          timestamp: Date.now()
        };
        return milestoneText;
      }
    }

    if (baseActionText) {
      updates["game/lastAction"] = {
        text: baseActionText,
        type: "success",
        timestamp: Date.now()
      };
    }
    return baseActionText;
  }

  hasNoValidTargets(playerId, room) {
    const lists = room?.lists || {};
    const playerIds = Object.keys(room?.players || {});
    const opponentIds = playerIds.filter(id => id !== playerId);
    if (opponentIds.length === 0) return true;
    return opponentIds.every(id => this.isPlayerListCompleted(id, lists));
  }

  // ==========================================================================
  // REAL ROOM URL ROUTING & SPA PERSISTENCE (#/ABCD, /ABCD, ?room=ABCD)
  // ==========================================================================

  getBaseUrl() {
    return window.location.origin + window.location.pathname;
  }

  getRoomUrl(roomCode) {
    const base = this.getBaseUrl().replace(/\/+$/, "");
    return `${base}/#/${roomCode}`;
  }

  updateRoomUrl(roomCode) {
    if (!roomCode) {
      try {
        const cleanBase = this.getBaseUrl();
        window.history.replaceState(null, "", cleanBase);
      } catch (e) {}
      return;
    }
    try {
      const roomUrl = this.getRoomUrl(roomCode);
      window.history.replaceState({ roomCode }, "", roomUrl);
    } catch (e) {}
  }

  getRoomCodeFromUrl() {
    // 1. Check URL hash: #/ABCD or #ABCD
    const rawHash = (window.location.hash || "").replace(/^#\/?/, "").trim().toUpperCase();
    if (rawHash) {
      const cleanHash = rawHash.replace(/[^A-Z]/g, "").slice(0, 4);
      if (cleanHash.length === 4) return cleanHash;
    }

    // 2. Check query params: ?room=ABCD or ?p=/ABCD (from 404.html SPA redirect)
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        const cleanParam = roomParam.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
        if (cleanParam.length === 4) return cleanParam;
      }
      const pParam = params.get("p");
      if (pParam) {
        const cleanP = pParam.replace(/^\/+|\/+$/g, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
        if (cleanP.length === 4) return cleanP;
      }
    } catch (e) {}

    // 3. Check direct pathname: /Ta5mena/ABCD or /ABCD
    try {
      const segments = window.location.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        const last = segments[segments.length - 1].toUpperCase();
        if (/^[A-Z]{4}$/.test(last) && !last.includes(".")) {
          return last;
        }
      }
    } catch (e) {}

    return null;
  }

  async initAppRouting() {
    // 1. Explicitly hide every modal and overlay on page load so none can block the Home Screen
    document.querySelectorAll(".modal-backdrop").forEach(modal => {
      modal.classList.remove("open");
      modal.classList.add("hidden");
    });
    this.closePrivacyCurtain();
    this.closeConfirmModal();
    this.closeHintsHubModal();
    this.closeGiveHintModal();
    this.toggleMyListDrawer(false);
    this.closeLocalRevealConfirm();
    this.closeLocalVerifyChoiceModal();
    this.closeLocalSecretTargetSlotsModal();

    // 2. Clear broken or corrupted local match state from localStorage
    const rawLocal = localStorage.getItem("ta5mena_local_match");
    if (rawLocal) {
      try {
        const parsed = JSON.parse(rawLocal);
        if (!parsed || typeof parsed !== "object" || !parsed.players || typeof parsed.players !== "object" || Object.keys(parsed.players).length < 2 || !parsed.meta) {
          localStorage.removeItem("ta5mena_local_match");
        }
      } catch (e) {
        localStorage.removeItem("ta5mena_local_match");
      }
    }

    // 3. Reset any in-memory local match state on boot so user is never trapped in a black screen
    this.isLocalMode = false;
    this.localMatch = null;
    this.localCurtainProceedCallback = null;
    this.localPendingVerify = null;

    // 4. Always boot to Tab 1: ONLINE MULTIPLAYER active by default
    this.switchHomeMode("online");

    // 5. Populate saved online player name
    const savedName = localStorage.getItem("ta5mena_player_name");
    if (savedName && this.inputPlayerName) {
      this.inputPlayerName.value = savedName;
      this.myPlayerName = savedName;
    }

    // 6. Initialize local setup defaults and check if valid saved match exists for the resume button
    this.renderLocalPlayerInputs();
    this.checkLocalMatchSaved();

    const roomCodeFromUrl = this.getRoomCodeFromUrl();

    // If base website URL with NO room code in URL:
    // ALWAYS show the fresh Home Screen (Create / Join Room) and clear any stale room session!
    if (!roomCodeFromUrl) {
      localStorage.removeItem("ta5mena_room_code");
      this.currentRoomCode = null;
      this.reconnectBox?.classList.add("hidden");
      this.switchView("home");
      return;
    }

    // Specific room URL requested: sync canonical hash into address bar
    this.updateRoomUrl(roomCodeFromUrl);

    let room = null;
    try {
      room = await db.get(`rooms/${roomCodeFromUrl}`);
    } catch (err) {}

    // Check if room expired, does not exist, or has 0 connected players after inactivity
    const lastActivity = room?.lastActivity || room?.meta?.createdAt || 0;
    const isInactive1Hr = (Date.now() - lastActivity) > 3600000;
    const players = Object.values(room?.players || {});
    const allOffline = players.length === 0 || players.every(p => p.connected === false);
    const roomAge = Date.now() - (room?.meta?.createdAt || lastActivity);
    const isDead10Min = allOffline && roomAge > 600000;

    if (!room || isInactive1Hr || isDead10Min) {
      if (room) {
        try {
          await db.remove(`rooms/${roomCodeFromUrl}`);
        } catch (e) {}
      }
      this.discardSession();
      try {
        window.location.hash = "";
        this.updateRoomUrl(null);
      } catch (e) {}
      this.switchView("home");
      this.showAlert("Room expired or no longer exists.");
      return;
    }

    const status = room?.meta?.status;
    const isLobbyOrWaiting = (status === "lobby" || status === "waiting");
    const isSolo = players.length <= 1;

    // RULE 1: If room is in lobby/waiting state with <= 1 player, delete rooms/{roomCode}, clear localStorage, strip URL, and go to clean Home Screen without any message
    if (isLobbyOrWaiting && isSolo) {
      try {
        await db.remove(`rooms/${roomCodeFromUrl}`);
      } catch (e) {}
      this.discardSession();
      try {
        window.location.hash = "";
        this.updateRoomUrl(null);
      } catch (e) {}
      this.switchView("home");
      return;
    }

    // RULE 2: NEVER auto-reconnect on page load/refresh if room status is "lobby" / "waiting" (before game has started) OR if room has only 1 player
    if (isLobbyOrWaiting || isSolo) {
      this.discardSession();
      try {
        window.location.hash = "";
        this.updateRoomUrl(null);
      } catch (e) {}
      this.inputRoomCode.value = roomCodeFromUrl;
      this.switchView("home");
      return;
    }

    // Room is active (game started: "entry", "playing", "game_over"): check if saved playerId belongs to this room
    const savedPlayerId = localStorage.getItem("ta5mena_player_id");
    const hostId = this.getRoomHostId(room);
    const hostPlayer = hostId && room.players ? room.players[hostId] : null;

    let seatPlayer = null;
    if (savedPlayerId && room.players && room.players[savedPlayerId]) {
      seatPlayer = room.players[savedPlayerId];
    } else if (hostPlayer && savedName && hostPlayer.name.trim().toLowerCase() === savedName.trim().toLowerCase()) {
      seatPlayer = hostPlayer;
    }

    if (seatPlayer) {
      // Reconnect existing seat
      const me = seatPlayer;
      this.myPlayerId = me.id;
      this.myPlayerName = me.name;
      this.currentRoomCode = roomCodeFromUrl;
      this.saveSession(me.id, me.name, roomCodeFromUrl);
      this.reconnectBox.classList.add("hidden");

      await this.touchRoomActivity(roomCodeFromUrl);
      await db.update(`rooms/${roomCodeFromUrl}`, {
        [`players/${me.id}/connected`]: true,
        [`players/${me.id}/left`]: false,
        lastActivity: Date.now()
      });
      await db.trackPlayerConnection(roomCodeFromUrl, me.id);
      this.subscribeToRoom(roomCodeFromUrl);
      this.showAlert(`Reconnected to room ${roomCodeFromUrl}!`);
    } else {
      // Player does not have a seat in this room: pre-fill room code on Home Screen
      this.inputRoomCode.value = roomCodeFromUrl;
      this.switchView("home");
      if (!savedName) {
        this.inputPlayerName.focus();
      }
      this.showAlert(`Enter your name and tap Join Room to enter ${roomCodeFromUrl}.`);
    }
  }

  // ==========================================================================
  // SESSION PERSISTENCE & TOUCH HELPERS
  // ==========================================================================

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

  async touchRoomActivity(roomCode = this.currentRoomCode) {
    if (!roomCode) return;
    try {
      await db.update(`rooms/${roomCode}`, { lastActivity: Date.now() });
    } catch (e) {}
  }

  async handleReconnect() {
    await this.initAppRouting();
  }

  startLivenessCheck() {
    setInterval(async () => {
      if (!this.currentRoomCode || !this.roomData) return;
      const lastAct = this.roomData.lastActivity || this.roomData.meta?.createdAt || 0;
      if (Date.now() - lastAct > 3600000) {
        const code = this.currentRoomCode;
        if (this.isHost) {
          try {
            await db.remove(`rooms/${code}`);
          } catch (e) {}
        }
        this.leaveRoom();
        this.showAlert("Room closed after 1 hour of inactivity.");
      }
    }, 60000);
  }

  // ==========================================================================
  // ROOM CREATION & JOINING
  // ==========================================================================

  getRoomHostId(room = this.roomData) {
    if (!room) return null;
    return room.meta?.hostId || room.hostId || null;
  }

  generateRoomCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Strictly uppercase letters (no 0-9)
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
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
      lastActivity: Date.now(),
      hostId: playerId,
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
          correctGuesses: 0,
          listSubmitted: false,
          targetCompleted: false,
          connected: true
        }
      },
      lists: {},
      finishedOrder: [],
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
    await db.registerSoloLobbyDisconnect(roomCode);
    await db.trackPlayerConnection(roomCode, playerId);
    this.saveSession(playerId, name, roomCode);
    this.updateRoomUrl(roomCode);
    this.subscribeToRoom(roomCode);
  }

  async handleJoinRoom() {
    const name = this.inputPlayerName.value.trim();
    const code = this.inputRoomCode.value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

    if (!name) {
      this.showAlert("Please enter your name first.");
      this.inputPlayerName.focus();
      return;
    }
    if (code.length !== 4) {
      this.showAlert("Room code must be 4 letters.");
      this.inputRoomCode.focus();
      return;
    }

    const room = await db.get(`rooms/${code}`);
    if (!room) {
      this.showAlert(`Room "${code}" not found.`);
      return;
    }

    const savedPlayerId = localStorage.getItem("ta5mena_player_id");
    const existingPlayers = Object.values(room.players || {});
    const normInputName = name.trim().toLowerCase();
    const hostId = this.getRoomHostId(room);
    const hostPlayer = hostId && room.players ? room.players[hostId] : null;

    // 1. Seat Rejoin / Reconnection (prioritizing host seat if matching host name, or saved playerId, or matching seat name)
    let seatPlayer = null;
    if (hostPlayer && hostPlayer.name && hostPlayer.name.trim().toLowerCase() === normInputName) {
      seatPlayer = hostPlayer;
    } else if (savedPlayerId && room.players && room.players[savedPlayerId]) {
      seatPlayer = room.players[savedPlayerId];
    } else {
      seatPlayer = existingPlayers.find(p => p.name && p.name.trim().toLowerCase() === normInputName);
    }

    if (seatPlayer) {
      const updates = {};
      updates[`players/${seatPlayer.id}/connected`] = true;
      updates[`players/${seatPlayer.id}/left`] = false;
      updates["lastActivity"] = Date.now();

      if (room.meta && room.meta.status === "playing") {
        const currentTurnOrder = room.game?.turnOrder || [];
        if (!currentTurnOrder.includes(seatPlayer.id)) {
          updates["game/turnOrder"] = [...currentTurnOrder, seatPlayer.id];
        }

        // Active players after rejoining (bringing active count back to 3+)
        const activeCount = existingPlayers.filter(p => p.id !== seatPlayer.id && !p.left).length + 1;
        if (activeCount >= 3) {
          updates["game/lastAction"] = {
            text: `${seatPlayer.name} rejoined! Match returned to 3+ Player Mode.`,
            type: "general",
            timestamp: Date.now()
          };
        }
      }

      await db.update(`rooms/${code}`, updates);
      this.saveSession(seatPlayer.id, seatPlayer.name, code);
      await this.touchRoomActivity(code);
      await db.setPlayerConnected(code, seatPlayer.id, true);
      await db.trackPlayerConnection(code, seatPlayer.id);
      this.updateRoomUrl(code);
      this.subscribeToRoom(code);
      this.showAlert(`Welcome back, ${seatPlayer.name}! Reconnected to seat.`);
      return;
    }

    // 2. Block duplicate player names (Fix Host Hijacking Bug):
    const nameTaken = existingPlayers.some(
      p => p.name && p.name.trim().toLowerCase() === normInputName && !p.left && p.id !== savedPlayerId
    );

    if (nameTaken) {
      this.showAlert("That name is already taken in this room. Please choose a different name.");
      this.inputPlayerName.focus();
      return;
    }

    if (room.meta && room.meta.status !== "lobby") {
      this.showAlert("This match has already started and you do not have an existing seat in this room.");
      return;
    }

    // 3. Brand new player joining lobby
    const playerId = this.generatePlayerId();
    const newPlayer = {
      id: playerId,
      name: name,
      isHost: false,
      points: 0,
      correctGuesses: 0,
      listSubmitted: false,
      targetCompleted: false,
      connected: true
    };

    await db.update(`rooms/${code}/players/${playerId}`, newPlayer);
    await this.touchRoomActivity(code);
    await db.trackPlayerConnection(code, playerId);
    this.saveSession(playerId, name, code);
    this.updateRoomUrl(code);
    this.subscribeToRoom(code);
  }

  // ==========================================================================
  // CONFIRMATION MODAL & LEAVE ROOM ENGINE
  // ==========================================================================

  showConfirmModal({ title, message, confirmText = "CONFIRM", confirmClass = "btn-danger", onConfirm }) {
    if (this.confirmModalTitle) this.confirmModalTitle.textContent = title;
    if (this.confirmModalMessage) this.confirmModalMessage.textContent = message;
    if (this.btnModalConfirmAction) {
      this.btnModalConfirmAction.textContent = confirmText;
      this.btnModalConfirmAction.className = `btn btn-block ${confirmClass}`;
    }
    this.pendingConfirmCallback = onConfirm;
    if (this.modalConfirm) {
      this.modalConfirm.classList.remove("hidden");
      this.modalConfirm.classList.add("open");
    }
  }

  closeConfirmModal() {
    if (this.modalConfirm) {
      this.modalConfirm.classList.remove("open");
      this.modalConfirm.classList.add("hidden");
    }
    this.pendingConfirmCallback = null;
  }

  requestLeaveRoom() {
    this.executeLeaveRoom();
  }

  async executeLeaveRoom() {
    const roomCode = this.currentRoomCode;
    const playerId = this.myPlayerId;
    const playerName = this.myPlayerName;

    // 1. FIRST: Detach all active Firebase listeners for this room so client is immediately detached
    if (this.roomUnsubscribe) {
      try { this.roomUnsubscribe(); } catch (e) {}
      this.roomUnsubscribe = null;
    }
    if (roomCode) {
      try { await db.off(`rooms/${roomCode}`); } catch (e) {}
    }
    if (roomCode && playerId) {
      try { await db.stopPlayerConnectionTracking(roomCode, playerId); } catch (e) {}
    }

    // 2. Wipe room session from localStorage & reset state right away
    this.discardSession();
    this.currentRoomCode = null;
    this.roomData = null;
    this.isHost = false;

    // 3. Reset URL back to base homepage
    try {
      window.location.hash = "";
      this.updateRoomUrl(null);
    } catch (e) {}

    // 4. Clean up UI elements & switch to Home Screen instantly
    this.headerRoomStack?.classList.add("hidden");
    this.btnHeaderHints?.classList.add("hidden");
    this.btnHeaderMyList?.classList.add("hidden");
    this.btnHeaderLeave?.classList.add("hidden");
    this.modalMyList?.classList.remove("open");
    this.modalMyList?.classList.add("hidden");
    if (this.modalHintsHub) { this.modalHintsHub.classList.remove("open"); this.modalHintsHub.classList.add("hidden"); }
    if (this.modalIncomingHintRequest) { this.modalIncomingHintRequest.classList.remove("open"); this.modalIncomingHintRequest.classList.add("hidden"); }
    if (this.modalLocalHintRequest) { this.modalLocalHintRequest.classList.remove("open"); this.modalLocalHintRequest.classList.add("hidden"); }
    if (this.modalConfirmation) { this.modalConfirmation.classList.remove("open"); this.modalConfirmation.classList.add("hidden"); }
    if (this.waitingConfirmationBackdrop) { this.waitingConfirmationBackdrop.classList.remove("open"); this.waitingConfirmationBackdrop.classList.add("hidden"); }
    if (this.modalPrivacyCurtain) { this.modalPrivacyCurtain.classList.remove("open"); this.modalPrivacyCurtain.classList.add("hidden"); }
    if (this.modalLocalRevealConfirm) { this.modalLocalRevealConfirm.classList.remove("open"); this.modalLocalRevealConfirm.classList.add("hidden"); }
    if (this.modalLocalVerifyChoice) { this.modalLocalVerifyChoice.classList.remove("open"); this.modalLocalVerifyChoice.classList.add("hidden"); }
    if (this.modalLocalSecretTargetSlots) { this.modalLocalSecretTargetSlots.classList.remove("open"); this.modalLocalSecretTargetSlots.classList.add("hidden"); }
    this.pendingIncomingHintRequest = null;
    this.pendingLocalHintRequest = null;
    this.isRespondingToHintRequest = false;
    this.isLocalHintResponse = false;
    this.localHintOriginPlayerId = null;
    this.requestedHintSlot = null;
    this.lastHandledHintRequestTimestamp = 0;
    this.hidePauseOverlay();
    this.closeGiveHintModal();
    this.closeHintsHubModal();
    this.closeConfirmModal();
    this.switchView("home");

    // 5. Background cleanup: Remove player from Firebase or delete solo room
    if (roomCode && playerId) {
      try {
        const room = await db.get(`rooms/${roomCode}`);
        if (room && room.players) {
          const hostId = this.getRoomHostId(room);
          const isPlayerHost = (playerId === hostId);
          const remainingPlayers = Object.values(room.players).filter(p => p.id !== playerId && !p.left);
          const isLobby = !room.meta || room.meta.status === "lobby" || room.meta.status === "waiting";

          if (remainingPlayers.length === 0 || (isLobby && isPlayerHost && remainingPlayers.length === 0)) {
            // Delete room completely if empty
            await db.remove(`rooms/${roomCode}`);
          } else if (isLobby) {
            const updates = {};
            updates[`players/${playerId}`] = null;
            updates[`lists/${playerId}`] = null;
            updates[`lastActivity`] = Date.now();
            await db.update(`rooms/${roomCode}`, updates);
          } else {
            // In active match (playing or entry):
            if (isPlayerHost) {
              // Host left during active match or list entry:
              // Do NOT delete the Host's player node, do NOT transfer host powers, and do NOT switch to 2-player rules or end the room.
              // Simply set players/{hostId}/connected = false.
              const updates = {};
              updates[`players/${playerId}/connected`] = false;
              updates[`lastActivity`] = Date.now();
              await db.update(`rooms/${roomCode}`, updates);
              // Do NOT call cleanUpDepartedPlayer for Host!
            } else {
              // Non-host player left: preserve list so player can rejoin mid-game!
              const updates = {};
              updates[`players/${playerId}/left`] = true;
              updates[`players/${playerId}/connected`] = false;
              updates[`lastActivity`] = Date.now();
              await db.update(`rooms/${roomCode}`, updates);

              if (room.meta && room.meta.status === "playing") {
                await this.cleanUpDepartedPlayer(playerId, playerName);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Ta5mena] Error during background leave:", err);
      }
    }
  }

  leaveRoom() {
    this.executeLeaveRoom();
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

      const hostId = this.getRoomHostId(room);
      this.isHost = Boolean(hostId && this.myPlayerId === hostId);
      this.category = room.meta?.category || "singers";

      // Check pause state: if any player has connected === false during match, show pause overlay
      this.checkGamePauseState(room);

      // Live floating notification for game events
      if (room.game?.lastAction?.text && room.game.lastAction.timestamp) {
        const actionTs = room.game.lastAction.timestamp;
        if (actionTs > this.lastSeenActionTimestamp) {
          this.lastSeenActionTimestamp = actionTs;
          if (Date.now() - actionTs < 15000) {
            this.showFloatingNotification(room.game.lastAction.text, room.game.lastAction.type || "general");
          }
        }
      }

      // Check if any opponent dropped hints
      this.checkForNewHints(room);

      // Check incoming hint request (Online Multiplayer)
      this.checkIncomingHintRequest(room);

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

    const hostId = this.getRoomHostId(room);
    const players = Object.values(room.players || {});
    // Active disconnected players: Host if offline, or non-host who has not permanently left
    const disconnected = players.filter(p => p.connected === false && (p.id === hostId || !p.left));

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
    this.modalPauseOverlay.classList.remove("hidden");
    this.modalPauseOverlay.classList.add("open");

    const hostId = this.getRoomHostId(room);
    const hostPlayer = hostId && room.players ? room.players[hostId] : null;
    const hostName = hostPlayer?.name || "Host";
    const roomCode = room.meta?.code || this.currentRoomCode || "----";

    if (this.pauseRoomCodeTag) {
      this.pauseRoomCodeTag.textContent = `ROOM: ${roomCode}`;
    }

    const isHostDisconnected = disconnected.some(p => p.id === hostId);

    if (isHostDisconnected) {
      // Host is disconnected or left: pause game and wait for Host to return
      if (this.pauseOverlayTitle) {
        this.pauseOverlayTitle.textContent = "GAME PAUSED";
      }
      if (this.pauseOverlayMessage) {
        this.pauseOverlayMessage.innerHTML = `GAME PAUSED - Waiting for the Host (<strong class="text-accent">${this.escapeHtml(hostName)}</strong>) to return to the room... (Room Code: ${this.escapeHtml(roomCode)})`;
      } else if (this.pauseDisconnectedNames) {
        this.pauseDisconnectedNames.textContent = `Host (${hostName})`;
      }
      if (this.pauseOverlaySubtitle) {
        this.pauseOverlaySubtitle.textContent = "All scores, turns, and Top 10 lists are locked. The match will automatically resume as soon as they reconnect.";
      }

      // Inside Pause Overlay when Host is disconnected, NO ONE sees any kick buttons
      if (this.pauseHostActions) {
        this.pauseHostActions.classList.add("hidden");
      }
      if (this.pauseKickButtonsContainer) {
        this.pauseKickButtonsContainer.innerHTML = "";
      }
    } else {
      // Regular non-host player(s) disconnected
      const nonHostDisconnected = disconnected.filter(p => p.id !== hostId);
      const names = nonHostDisconnected.map(p => p.name).join(", ");

      if (this.pauseOverlayTitle) {
        this.pauseOverlayTitle.textContent = "GAME PAUSED";
      }
      if (this.pauseOverlayMessage) {
        this.pauseOverlayMessage.innerHTML = `Waiting for <strong class="text-accent">${this.escapeHtml(names)}</strong> to reconnect...`;
      } else if (this.pauseDisconnectedNames) {
        this.pauseDisconnectedNames.textContent = names;
      }
      if (this.pauseOverlaySubtitle) {
        this.pauseOverlaySubtitle.textContent = "All scores, turns, and Top 10 lists are locked. The match will automatically resume as soon as they reconnect.";
      }

      // ONLY show kick buttons if the current user IS the Host (and host is connected)
      if (this.isHost && this.myPlayerId === hostId) {
        if (this.pauseHostActions) {
          this.pauseHostActions.classList.remove("hidden");
        }
        if (this.pauseKickButtonsContainer) {
          this.pauseKickButtonsContainer.innerHTML = "";
          nonHostDisconnected.forEach(p => {
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
        }
      } else {
        // Non-host player viewing pause screen: ZERO kick buttons!
        if (this.pauseHostActions) {
          this.pauseHostActions.classList.add("hidden");
        }
        if (this.pauseKickButtonsContainer) {
          this.pauseKickButtonsContainer.innerHTML = "";
        }
      }
    }
  }

  hidePauseOverlay() {
    if (this.modalPauseOverlay) {
      this.modalPauseOverlay.classList.remove("open");
      this.modalPauseOverlay.classList.add("hidden");
    }
  }

  handleKickDisconnectedPlayer(kickedId, kickedName) {
    const hostId = this.getRoomHostId(this.roomData);
    if (!this.isHost || this.myPlayerId !== hostId || kickedId === hostId) return;
    this.handleKickPlayer(kickedId, kickedName);
  }

  async cleanUpDepartedPlayer(kickedId, kickedName) {
    const room = this.roomData || (this.currentRoomCode ? await db.get(`rooms/${this.currentRoomCode}`) : null);
    const game = room?.game || {};
    const currentTurnOrder = game.turnOrder || [];
    const updatedTurnOrder = currentTurnOrder.filter(id => id !== kickedId);
    const remainingActivePlayers = Object.values(room?.players || {}).filter(p => p.id !== kickedId && !p.left);

    if (remainingActivePlayers.length < 2) {
      await db.update(`rooms/${this.currentRoomCode}/meta`, {
        status: "aborted",
        abortedReason: "Not enough players remaining to continue. Match closed."
      });
      return;
    }

    const updates = {
      "game/turnOrder": updatedTurnOrder,
      [`players/${kickedId}/left`]: true,
      [`players/${kickedId}/connected`]: false
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

    if (remainingActivePlayers.length === 2) {
      updates["game/lastAction"] = {
        text: "Player left! Match switched to 2-Player Mode (First to finish opponent's list wins).",
        type: "milestone",
        timestamp: Date.now()
      };
    } else {
      updates["game/lastAction"] = {
        text: `${kickedName} left the room. Continuing match.`,
        type: "general",
        timestamp: Date.now()
      };
    }

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
          const hintKey = `${pid}_${slotRank}_${hint.timestamp || ''}_${hint.text || ''}`;
          if (!this.seenHints.has(hintKey)) {
            this.seenHints.add(hintKey);
            // Prominent live toast: "[Player Name] dropped a hint for their #N pick: [Hint Text]"
            if (pid !== this.myPlayerId && (!hint.timestamp || hint.timestamp > (this.connectedTimestamp - 5000))) {
              this.showAlert(`${p.name} dropped a hint for their #${slotRank} pick: ${hint.text}`, "hint");
            }
          }
        });
      }
    });
  }

  openHintsHubModal(defaultTab = "request") {
    const isOnline = !this.isLocalMode;
    const room = isOnline ? this.roomData : this.localMatch;
    if (!room || !room.lists || !this.myPlayerId) {
      this.showAlert("Waiting for game list data...");
      return;
    }
    const isPlaying = (room.meta?.status === "playing");
    const activePlayerId = room.game?.activePlayerId || (room.game?.turnOrder ? room.game.turnOrder[room.game.currentTurnIndex || 0] : null);
    const isMyTurn = (isPlaying && activePlayerId === this.myPlayerId);
    const isResponding = this.isRespondingToHintRequest || (!isMyTurn && isPlaying);

    if (!isMyTurn && !isResponding) {
      this.showAlert("You can only drop hints during your turn or when responding to a hint request!");
      return;
    }

    if (isResponding) {
      this.isRespondingToHintRequest = true;
      const requesterName = this.pendingIncomingHintRequest?.fromPlayerName || 
                            this.pendingLocalHintRequest?.fromPlayerName || 
                            room.hintRequest?.fromPlayerName || 
                            "Opponent";
      const reqSlot = this.requestedHintSlot || 
                      this.pendingIncomingHintRequest?.requestedSlot || 
                      this.pendingLocalHintRequest?.requestedSlot;

      // 1. Completely HIDE the two top tab buttons
      if (this.hintsTabBar) {
        this.hintsTabBar.style.display = "none";
      }

      // 2. Change modal header title
      if (this.hintsHubTitle) {
        if (reqSlot && reqSlot !== "any") {
          this.hintsHubTitle.textContent = `Drop a Hint for ${requesterName} (#${reqSlot})`;
        } else {
          this.hintsHubTitle.textContent = `Drop a Hint for ${requesterName}`;
        }
      }

      if (this.hintsHubStatusBadge) {
        this.hintsHubStatusBadge.textContent = "INCOMING REQUEST";
        this.hintsHubStatusBadge.style.color = "var(--accent)";
      }

      if (this.hintsHubTagBadge) {
        this.hintsHubTagBadge.textContent = "GIVE CLUE";
      }

      // 3. Show prominent [ I Changed My Mind (Cancel) ] button
      if (this.btnHintsCancelMind) {
        this.btnHintsCancelMind.classList.remove("hidden");
      }
      if (this.btnDismissHintsHub) {
        this.btnDismissHintsHub.classList.add("hidden");
      }

      // Force Tab 2 'give'
      this.switchHintsTab("give");
    } else {
      // Active turn mode
      if (this.hintsTabBar) {
        this.hintsTabBar.style.display = "";
      }
      if (this.hintsHubTitle) {
        this.hintsHubTitle.textContent = "Request or Give Clues";
      }
      if (this.hintsHubStatusBadge) {
        this.hintsHubStatusBadge.textContent = "ACTIVE TURN";
        this.hintsHubStatusBadge.style.color = "#FFD700";
      }
      if (this.hintsHubTagBadge) {
        this.hintsHubTagBadge.textContent = "HINTS HUB";
      }
      if (this.btnHintsCancelMind) {
        this.btnHintsCancelMind.classList.add("hidden");
      }
      if (this.btnDismissHintsHub) {
        this.btnDismissHintsHub.classList.remove("hidden");
      }

      this.switchHintsTab(defaultTab);
    }

    if (this.modalHintsHub) {
      this.modalHintsHub.classList.remove("hidden");
      this.modalHintsHub.classList.add("open");
    }
  }

  closeHintsHubModal() {
    if (this.isRespondingToHintRequest) {
      this.handleCancelHintResponse();
      return;
    }
    this.closeHintsHubModalRaw();
  }

  closeHintsHubModalRaw() {
    if (this.modalHintsHub) {
      this.modalHintsHub.classList.remove("open");
      this.modalHintsHub.classList.add("hidden");
    }
    if (this.hintsHubStatusBadge) {
      this.hintsHubStatusBadge.textContent = "ACTIVE TURN";
      this.hintsHubStatusBadge.style.color = "";
    }
    if (this.hintsHubTitle) {
      this.hintsHubTitle.textContent = "Request or Give Clues";
    }
    if (this.hintsHubTagBadge) {
      this.hintsHubTagBadge.textContent = "HINTS HUB";
    }
    if (this.hintsTabBar) {
      this.hintsTabBar.style.display = "";
    }
    if (this.btnHintsCancelMind) {
      this.btnHintsCancelMind.classList.add("hidden");
    }
    if (this.btnDismissHintsHub) {
      this.btnDismissHintsHub.classList.remove("hidden");
    }
  }

  async handleCancelHintResponse() {
    const isResponding = this.isRespondingToHintRequest;
    const playerName = this.myPlayerName || "Player";
    const declineMsg = `${playerName} changed their mind and declined the hint request.`;

    if (this.isLocalMode) {
      this.closeHintsHubModalRaw();
      const originId = this.localHintOriginPlayerId;
      const originName = originId ? (this.localMatch?.players?.[originId]?.name || "Turn Player") : null;

      if (isResponding) {
        this.localMatch.game.lastAction = {
          text: declineMsg,
          type: "general",
          timestamp: Date.now()
        };
        this.saveLocalMatch(this.localMatch);
        this.showFloatingNotification(declineMsg, "general");
      }

      this.isRespondingToHintRequest = false;
      this.isLocalHintResponse = false;
      this.requestedHintSlot = null;
      this.pendingLocalHintRequest = null;

      if (originId) {
        this.myPlayerId = originId;
        this.localHintOriginPlayerId = null;
        this.showPrivacyCurtain(
          originName,
          "Resuming turn. Make sure only the active player sees the screen.",
          () => {
            this.renderBoardSlots(this.localMatch);
            this.updateMyListButtonVisibility(this.localMatch);
          }
        );
      }
      return;
    }

    // Online Multiplayer Mode
    this.closeHintsHubModalRaw();
    this.isRespondingToHintRequest = false;
    this.requestedHintSlot = null;
    this.pendingIncomingHintRequest = null;

    if (this.currentRoomCode && isResponding) {
      const updates = {};
      updates["hintRequest"] = null;
      updates["game/lastAction"] = {
        text: declineMsg,
        type: "general",
        timestamp: Date.now()
      };
      updates["lastActivity"] = Date.now();
      await db.update(`rooms/${this.currentRoomCode}`, updates);
    }
    this.showFloatingNotification("You changed your mind and declined the hint request.", "general");
  }

  switchHintsTab(tabName) {
    this.activeHintHubTab = tabName;
    if (this.btnTabHintRequest) {
      this.btnTabHintRequest.classList.toggle("active", tabName === "request");
    }
    if (this.btnTabHintGive) {
      this.btnTabHintGive.classList.toggle("active", tabName === "give");
    }
    if (this.hintsTabRequestPane) {
      this.hintsTabRequestPane.classList.toggle("hidden", tabName !== "request");
    }
    if (this.hintsTabGivePane) {
      this.hintsTabGivePane.classList.toggle("hidden", tabName !== "give");
    }

    if (tabName === "request") {
      this.renderHintRequestPane();
    } else {
      this.renderHintsHubSlots();
    }
  }

  renderHintRequestPane() {
    const isOnline = !this.isLocalMode;
    const room = isOnline ? this.roomData : this.localMatch;
    if (!room || !room.players || !room.lists || !this.myPlayerId) return;

    const allPlayers = Object.values(room.players || {});
    const lists = room.lists || {};

    // Filter opponents who still have hidden slots
    const opponentsWithHidden = allPlayers.filter(p => {
      if (p.id === this.myPlayerId) return false;
      if (isOnline && p.connected === false) return false;
      return !this.isPlayerListCompleted(p.id, lists);
    });

    if (!this.hintRequestOpponentsGrid || !this.hintRequestSlotsGrid) return;
    this.hintRequestOpponentsGrid.innerHTML = "";
    this.hintRequestSlotsGrid.innerHTML = "";

    if (opponentsWithHidden.length === 0) {
      this.hintRequestOpponentsGrid.innerHTML = `
        <div class="text-secondary" style="font-size: 12px; padding: 8px 0;">
          All opponents' lists are fully revealed! No hints can be requested.
        </div>
      `;
      if (this.btnSendHintRequest) {
        this.btnSendHintRequest.disabled = true;
      }
      return;
    }

    if (this.btnSendHintRequest) {
      this.btnSendHintRequest.disabled = false;
    }

    if (!this.hintRequestOpponentId || !opponentsWithHidden.some(p => p.id === this.hintRequestOpponentId)) {
      this.hintRequestOpponentId = opponentsWithHidden[0].id;
    }

    opponentsWithHidden.forEach(opp => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn hint-req-opponent-btn" + (opp.id === this.hintRequestOpponentId ? " selected" : "");
      
      const oppList = lists[opp.id] || {};
      let hiddenCount = 0;
      for (let r = 1; r <= 10; r++) {
        if (!oppList[r] || !oppList[r].revealed) hiddenCount++;
      }

      btn.innerHTML = `
        <span style="font-weight: 700;">${this.escapeHtml(opp.name)}</span>
        <span class="mono text-secondary" style="font-size: 11px;">(${hiddenCount} hidden)</span>
      `;
      btn.addEventListener("click", () => {
        this.hintRequestOpponentId = opp.id;
        this.renderHintRequestPane();
      });
      this.hintRequestOpponentsGrid.appendChild(btn);
    });

    const selectedOppList = lists[this.hintRequestOpponentId] || {};
    const hiddenSlots = [];
    for (let r = 10; r >= 1; r--) {
      if (!selectedOppList[r] || !selectedOppList[r].revealed) {
        hiddenSlots.push(r);
      }
    }

    if (this.hintRequestSlot !== "any" && !hiddenSlots.includes(Number(this.hintRequestSlot))) {
      this.hintRequestSlot = "any";
    }

    const anyBtn = document.createElement("button");
    anyBtn.type = "button";
    anyBtn.className = "btn hint-req-slot-btn" + (this.hintRequestSlot === "any" ? " selected" : "");
    anyBtn.innerHTML = `<span>ANY HIDDEN SLOT</span>`;
    anyBtn.addEventListener("click", () => {
      this.hintRequestSlot = "any";
      this.updateHintRequestSlotSelection();
    });
    this.hintRequestSlotsGrid.appendChild(anyBtn);

    hiddenSlots.forEach(r => {
      const slotBtn = document.createElement("button");
      slotBtn.type = "button";
      slotBtn.className = "btn hint-req-slot-btn" + (Number(this.hintRequestSlot) === r ? " selected" : "");
      slotBtn.setAttribute("data-rank", r);
      slotBtn.innerHTML = `
        <strong>#${r}</strong>
        <span class="mono text-secondary" style="font-size: 10px;">${r}pts</span>
      `;
      slotBtn.addEventListener("click", () => {
        this.hintRequestSlot = r;
        this.updateHintRequestSlotSelection();
      });
      this.hintRequestSlotsGrid.appendChild(slotBtn);
    });
  }

  updateHintRequestSlotSelection() {
    if (!this.hintRequestSlotsGrid) return;
    const buttons = this.hintRequestSlotsGrid.querySelectorAll(".hint-req-slot-btn");
    buttons.forEach(btn => {
      const rankAttr = btn.getAttribute("data-rank");
      if (!rankAttr) {
        btn.classList.toggle("selected", this.hintRequestSlot === "any");
      } else {
        btn.classList.toggle("selected", Number(this.hintRequestSlot) === Number(rankAttr));
      }
    });
  }

  async handleSendHintRequest() {
    const isOnline = !this.isLocalMode;
    const room = isOnline ? this.roomData : this.localMatch;
    if (!room || !room.players) return;

    if (!this.hintRequestOpponentId) {
      this.showAlert("Please select an opponent to ask for a hint.");
      return;
    }

    const targetPlayer = room.players[this.hintRequestOpponentId];
    if (!targetPlayer) {
      this.showAlert("Selected opponent is not valid.");
      return;
    }

    const requestedSlot = this.hintRequestSlot;
    const targetName = targetPlayer.name || "Opponent";
    const slotDesc = (requestedSlot === "any") ? "any hidden slot" : `slot #${requestedSlot}`;

    if (this.isLocalMode) {
      this.closeHintsHubModal();
      this.pendingLocalHintRequest = {
        fromPlayerId: this.myPlayerId,
        fromPlayerName: this.myPlayerName,
        targetPlayerId: this.hintRequestOpponentId,
        targetPlayerName: targetName,
        requestedSlot: requestedSlot,
        timestamp: Date.now()
      };
      this.openLocalHintRequestModal(this.pendingLocalHintRequest);
      return;
    }

    if (!this.currentRoomCode) return;
    const hintRequestObj = {
      fromPlayerId: this.myPlayerId,
      fromPlayerName: this.myPlayerName,
      targetPlayerId: this.hintRequestOpponentId,
      targetPlayerName: targetName,
      requestedSlot: requestedSlot,
      timestamp: Date.now(),
      status: "pending"
    };

    const updates = {};
    updates["hintRequest"] = hintRequestObj;
    updates["game/lastAction"] = {
      text: `${this.myPlayerName} requested a hint from ${targetName}!`,
      type: "hint",
      timestamp: Date.now()
    };
    updates["lastActivity"] = Date.now();

    await db.update(`rooms/${this.currentRoomCode}`, updates);
    this.closeHintsHubModal();
    this.showFloatingNotification(`Hint requested from ${targetName} for ${slotDesc}!`, "hint");
  }

  checkIncomingHintRequest(room) {
    if (this.isLocalMode) return;
    if (!room || !this.myPlayerId) return;

    const req = room.hintRequest;
    if (!req || req.status !== "pending") {
      if (this.modalIncomingHintRequest && !this.modalIncomingHintRequest.classList.contains("hidden")) {
        this.closeIncomingHintRequestModal();
      }
      return;
    }

    // Only target player should see this modal
    if (req.targetPlayerId !== this.myPlayerId) {
      if (this.modalIncomingHintRequest && !this.modalIncomingHintRequest.classList.contains("hidden")) {
        this.closeIncomingHintRequestModal();
      }
      return;
    }

    if (this.lastHandledHintRequestTimestamp === req.timestamp) {
      return;
    }

    this.pendingIncomingHintRequest = req;
    this.openIncomingHintRequestModal(req);
  }

  openIncomingHintRequestModal(req) {
    if (!this.modalIncomingHintRequest) return;
    if (this.incomingHintRequestTitle) {
      this.incomingHintRequestTitle.textContent = `${req.fromPlayerName || "An opponent"} requested a hint from you!`;
    }
    if (this.incomingHintRequestDesc) {
      if (req.requestedSlot && req.requestedSlot !== "any") {
        this.incomingHintRequestDesc.textContent = `Requested for your #${req.requestedSlot} slot. Would you like to drop a clue on the board?`;
      } else {
        this.incomingHintRequestDesc.textContent = "They are asking for a clue on any hidden slot before making their guess.";
      }
    }
    this.modalIncomingHintRequest.classList.remove("hidden");
    this.modalIncomingHintRequest.classList.add("open");
  }

  closeIncomingHintRequestModal() {
    if (this.modalIncomingHintRequest) {
      this.modalIncomingHintRequest.classList.remove("open");
      this.modalIncomingHintRequest.classList.add("hidden");
    }
  }

  async handleDeclineIncomingHintRequest() {
    const req = this.pendingIncomingHintRequest || this.roomData?.hintRequest;
    this.lastHandledHintRequestTimestamp = req?.timestamp || Date.now();
    this.closeIncomingHintRequestModal();
    this.pendingIncomingHintRequest = null;

    if (!this.currentRoomCode || !req) return;
    const updates = {};
    updates["hintRequest"] = null;
    updates["game/lastAction"] = {
      text: `${this.myPlayerName} declined ${req.fromPlayerName}'s hint request!`,
      type: "general",
      timestamp: Date.now()
    };
    updates["lastActivity"] = Date.now();
    await db.update(`rooms/${this.currentRoomCode}`, updates);
    this.showFloatingNotification("You declined the hint request.", "general");
  }

  async handleAcceptIncomingHintRequest() {
    const req = this.pendingIncomingHintRequest || this.roomData?.hintRequest;
    this.lastHandledHintRequestTimestamp = req?.timestamp || Date.now();
    this.closeIncomingHintRequestModal();

    if (!req) return;
    this.isRespondingToHintRequest = true;
    this.requestedHintSlot = req.requestedSlot;
    this.openHintsHubModal("give");
  }

  openLocalHintRequestModal(req) {
    if (!this.modalLocalHintRequest) return;
    if (this.localHintRequestTitle) {
      this.localHintRequestTitle.textContent = `${req.fromPlayerName} requested a hint from ${req.targetPlayerName}!`;
    }
    if (this.localHintRequestDesc) {
      if (req.requestedSlot && req.requestedSlot !== "any") {
        this.localHintRequestDesc.textContent = `Pass the phone to ${req.targetPlayerName} to give a secret hint for their #${req.requestedSlot} slot, or decline the request.`;
      } else {
        this.localHintRequestDesc.textContent = `Pass the phone to ${req.targetPlayerName} to give a secret hint on any hidden slot, or decline the request.`;
      }
    }
    this.modalLocalHintRequest.classList.remove("hidden");
    this.modalLocalHintRequest.classList.add("open");
  }

  closeLocalHintRequestModal() {
    if (this.modalLocalHintRequest) {
      this.modalLocalHintRequest.classList.remove("open");
      this.modalLocalHintRequest.classList.add("hidden");
    }
  }

  handleLocalDeclineHintRequest() {
    const req = this.pendingLocalHintRequest;
    this.closeLocalHintRequestModal();
    this.pendingLocalHintRequest = null;
    if (!req) return;

    this.localMatch.game.lastAction = {
      text: `${req.targetPlayerName} declined ${req.fromPlayerName}'s hint request!`,
      type: "general",
      timestamp: Date.now()
    };
    this.saveLocalMatch(this.localMatch);
    this.showFloatingNotification(`${req.targetPlayerName} declined ${req.fromPlayerName}'s hint request!`, "general");
  }

  handleLocalAcceptHintRequest() {
    const req = this.pendingLocalHintRequest;
    this.closeLocalHintRequestModal();
    if (!req) return;

    const targetName = req.targetPlayerName;
    const originName = req.fromPlayerName;

    this.showPrivacyCurtain(
      targetName,
      `${originName} requested a hint! Make sure only ${targetName} sees the secret list.`,
      () => {
        this.localHintOriginPlayerId = req.fromPlayerId;
        this.isRespondingToHintRequest = true;
        this.isLocalHintResponse = true;
        this.myPlayerId = req.targetPlayerId;
        this.requestedHintSlot = req.requestedSlot;
        this.openHintsHubModal("give");
      }
    );
  }

  renderHintsHubSlots() {
    const isOnline = !this.isLocalMode;
    const room = isOnline ? this.roomData : this.localMatch;
    if (!room || !room.lists || !this.myPlayerId) return;
    const myList = room.lists[this.myPlayerId] || {};
    const myHints = room.players?.[this.myPlayerId]?.hints || {};
    const activePlayerId = room.game?.activePlayerId || (room.game?.turnOrder ? room.game.turnOrder[room.game.currentTurnIndex || 0] : null);
    const isMyTurn = (room.meta?.status === "playing" && activePlayerId === this.myPlayerId);
    const isResponding = this.isRespondingToHintRequest || (!isMyTurn && room.meta?.status === "playing");

    if (!this.hintsHubSlotsList) return;
    this.hintsHubSlotsList.innerHTML = "";

    const bulbSvg = `<svg class="icon icon-bulb" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 2px;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>`;

    for (let r = 1; r <= 10; r++) {
      const slot = myList[r] || { item: "", revealed: false, points: r };
      const hint = myHints[r];
      
      // When responding to a hint request, show ONLY unguessed slots!
      if (isResponding && slot.revealed) {
        continue;
      }

      const isRequestedTarget = (this.requestedHintSlot && Number(this.requestedHintSlot) === r);
      const card = document.createElement("div");
      card.className = "hints-hub-slot-card" +
        (slot.revealed ? " is-revealed" : "") +
        (isRequestedTarget ? " is-requested-target" : "");
      card.setAttribute("data-slot-rank", r);

      if (slot.revealed) {
        card.innerHTML = `
          <div class="hints-hub-slot-row1">
            <div class="hints-hub-slot-item-info">
              <strong class="text-accent hints-hub-slot-rank">#${r}</strong>
              <span class="hints-hub-slot-name">${this.escapeHtml(slot.item || "Unknown")}</span>
              <span class="mono text-secondary hints-hub-slot-pts">(+${slot.points || r} pts)</span>
            </div>
            <span class="badge badge-success" style="font-size: 10px; white-space: nowrap;">REVEALED</span>
          </div>
          <div class="text-secondary" style="font-size: 11px;">Already revealed by ${this.escapeHtml(slot.guessedBy || "an opponent")}.</div>
        `;
      } else {
        const activeHintBadge = hint
          ? `<span class="board-slot-hint-bright" style="white-space: nowrap; font-size: 10px;">${bulbSvg} HINT SENT</span>`
          : `<span class="mono text-secondary" style="white-space: nowrap; font-size: 10px;">NO HINT</span>`;

        const targetBadge = isRequestedTarget
          ? `<span class="badge" style="background: rgba(255, 215, 0, 0.25); color: #FFD700; border: 1px solid #FFD700; font-weight: 800; font-size: 10px; margin-left: 4px; white-space: nowrap;">🎯 TARGET</span>`
          : "";

        card.innerHTML = `
          <!-- Row 1: Single-line flex row with slot on left and compact badge on right -->
          <div class="hints-hub-slot-row1">
            <div class="hints-hub-slot-item-info">
              <strong class="text-accent hints-hub-slot-rank">#${r}</strong>
              <span class="hints-hub-slot-name">${this.escapeHtml(slot.item || "Secret Pick")}</span>
              <span class="mono text-secondary hints-hub-slot-pts">(${r} pts)</span>
              ${targetBadge}
            </div>
            <div id="hints-hub-slot-status-${r}" class="hints-hub-slot-status">${activeHintBadge}</div>
          </div>

          <!-- Row 2: [ 1st Letter ] and [ Length ] side-by-side (grid 1fr 1fr) -->
          <div class="hints-hub-slot-row2">
            <button type="button" class="btn btn-hint-quick btn-hh-first-letter" data-rank="${r}">[ 1st Letter ]</button>
            <button type="button" class="btn btn-hint-quick btn-hh-length" data-rank="${r}">[ Length ]</button>
          </div>

          <!-- Row 3: Compact custom clue input (16px font-size, 36px height) + Send button -->
          <div class="hints-hub-slot-row3">
            <input type="text" class="input-hints-hub-custom" placeholder="Custom clue (max 35 chars)..." maxlength="35" data-rank="${r}">
            <button type="button" class="btn btn-primary btn-hints-hub-send" data-rank="${r}">Send</button>
          </div>
        `;

        const btnFirstLetter = card.querySelector(".btn-hh-first-letter");
        btnFirstLetter?.addEventListener("click", () => this.handleHintsHubFirstLetter(r, slot.item));

        const btnLength = card.querySelector(".btn-hh-length");
        btnLength?.addEventListener("click", () => this.handleHintsHubLength(r, slot.item));

        const inputCustom = card.querySelector(`.input-hints-hub-custom[data-rank="${r}"]`);
        const btnSend = card.querySelector(`.btn-hints-hub-send[data-rank="${r}"]`);
        const sendCustom = () => this.handleHintsHubCustom(r, slot.item, inputCustom?.value);

        btnSend?.addEventListener("click", sendCustom);
        inputCustom?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendCustom();
          }
        });
      }

      this.hintsHubSlotsList.appendChild(card);
    }

    // If a specific slot was requested, scroll it smoothly into view
    if (this.requestedHintSlot && Number(this.requestedHintSlot) >= 1 && Number(this.requestedHintSlot) <= 10) {
      setTimeout(() => {
        const targetEl = this.hintsHubSlotsList?.querySelector(`[data-slot-rank="${this.requestedHintSlot}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }

  async handleHintsHubFirstLetter(rank, item) {
    const cleanItem = (item || "").trim().replace(/^["']/, "");
    if (!cleanItem) return;
    const firstChar = cleanItem.charAt(0).toUpperCase();
    const hintText = `Starts with '${firstChar}'`;
    await this.broadcastHint(rank, "first_letter", hintText);
  }

  async handleHintsHubLength(rank, item) {
    const cleanItem = (item || "").trim().replace(/^["']/, "");
    if (!cleanItem) return;
    const words = cleanItem.split(/\s+/).filter(w => w.length > 0);
    const totalLetters = cleanItem.replace(/\s+/g, "").length;
    const wordText = words.length === 1 ? "1 word" : `${words.length} words`;
    const letterText = totalLetters === 1 ? "1 letter" : `${totalLetters} letters`;
    const hintText = `${wordText}, ${letterText}`;
    await this.broadcastHint(rank, "length", hintText);
  }

  async handleHintsHubCustom(rank, item, rawCustom) {
    const customVal = (rawCustom || "").trim().slice(0, 35);
    if (!customVal) {
      this.showAlert("Please enter a clue (max 35 chars).");
      return;
    }
    const normCustom = normalizeText(customVal);
    const normItem = normalizeText(item);
    if (normCustom === normItem || (normItem.length > 3 && normCustom.includes(normItem))) {
      this.showAlert("Hint cannot contain the exact secret answer!");
      return;
    }
    await this.broadcastHint(rank, "custom", customVal);
  }

  openGiveHintModal(rank, item) {
    this.openHintsHubModal("give");
  }

  closeGiveHintModal() {
    this.closeHintsHubModal();
    this.activeHintTargetSlot = null;
    if (this.modalGiveHint) {
      this.modalGiveHint.classList.remove("open");
      this.modalGiveHint.classList.add("hidden");
    }
  }

  async submitFirstLetterHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    await this.handleHintsHubFirstLetter(rank, item);
  }

  async submitWordCountHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    await this.handleHintsHubLength(rank, item);
  }

  async submitCustomHint() {
    if (!this.activeHintTargetSlot) return;
    const { rank, item } = this.activeHintTargetSlot;
    const customVal = this.inputCustomHint.value.trim().slice(0, 35);
    await this.handleHintsHubCustom(rank, item, customVal);
  }

  async broadcastHint(rank, type, hintText) {
    if (!this.myPlayerId) return;
    const hintData = {
      type: type,
      text: hintText,
      timestamp: Date.now()
    };

    if (this.isLocalMode) {
      if (!this.localMatch.players[this.myPlayerId].hints) {
        this.localMatch.players[this.myPlayerId].hints = {};
      }
      this.localMatch.players[this.myPlayerId].hints[rank] = hintData;

      const isLocalResponse = this.isLocalHintResponse;
      const targetName = this.localMatch.players[this.myPlayerId]?.name || "Player";
      const originId = this.localHintOriginPlayerId;
      const originName = originId ? (this.localMatch.players[originId]?.name || "Turn Player") : null;

      if (isLocalResponse) {
        this.localMatch.game.lastAction = {
          text: `${targetName} accepted and dropped a hint for #${rank}!`,
          type: "hint",
          timestamp: Date.now()
        };
      } else {
        this.localMatch.game.lastAction = {
          text: `${this.myPlayerName} dropped a hint for their #${rank} pick: ${hintText}`,
          type: "hint",
          timestamp: Date.now()
        };
      }
      this.saveLocalMatch(this.localMatch);

      if (this.modalGiveHint) {
        this.modalGiveHint.classList.remove("open");
        this.modalGiveHint.classList.add("hidden");
      }
      if (this.modalHintsHub) {
        this.modalHintsHub.classList.remove("open");
        this.modalHintsHub.classList.add("hidden");
      }

      const notifMsg = isLocalResponse
        ? `${targetName} accepted and dropped a hint for #${rank}!`
        : `Hint broadcast for #${rank} pick: "${hintText}"`;
      this.showFloatingNotification(notifMsg, "hint");

      if (isLocalResponse && originId) {
        this.myPlayerId = originId;
        this.isRespondingToHintRequest = false;
        this.isLocalHintResponse = false;
        this.localHintOriginPlayerId = null;
        this.requestedHintSlot = null;
        this.pendingLocalHintRequest = null;

        this.showPrivacyCurtain(
          originName,
          `${targetName} dropped a clue on the board. Your turn to guess!`,
          () => {
            this.renderBoardSlots(this.localMatch);
            this.updateMyListButtonVisibility(this.localMatch);
          }
        );
      } else {
        if (this.modalMyList?.classList.contains("open")) {
          this.renderMyListDrawer();
        }
        this.renderBoardSlots(this.localMatch);
      }
      return;
    }

    if (!this.currentRoomCode) return;
    const updates = {};
    updates[`players/${this.myPlayerId}/hints/${rank}`] = hintData;

    const isResponding = this.isRespondingToHintRequest || (this.roomData?.hintRequest?.targetPlayerId === this.myPlayerId);
    if (isResponding) {
      updates["hintRequest"] = null;
      updates["game/lastAction"] = {
        text: `${this.myPlayerName} accepted and dropped a hint for #${rank}!`,
        type: "hint",
        timestamp: Date.now()
      };
    } else {
      updates["game/lastAction"] = {
        text: `${this.myPlayerName} dropped a hint for their #${rank} pick: ${hintText}`,
        type: "hint",
        timestamp: Date.now()
      };
    }
    updates["lastActivity"] = Date.now();

    await db.update(`rooms/${this.currentRoomCode}`, updates);
    this.isRespondingToHintRequest = false;
    this.requestedHintSlot = null;
    this.pendingIncomingHintRequest = null;

    if (this.modalGiveHint) {
      this.modalGiveHint.classList.remove("open");
      this.modalGiveHint.classList.add("hidden");
    }
    this.closeHintsHubModalRaw();

    const notifMsg = isResponding
      ? `${this.myPlayerName} accepted and dropped a hint for #${rank}!`
      : `Hint broadcast for #${rank} pick: "${hintText}"`;
    this.showFloatingNotification(notifMsg, "hint");

    if (this.modalMyList?.classList.contains("open")) {
      this.renderMyListDrawer();
    }
  }

  updateMyListButtonVisibility(room) {
    if (!room || !this.myPlayerId) {
      this.btnHeaderMyList?.classList.add("hidden");
      this.btnHeaderHints?.classList.add("hidden");
      return;
    }
    const me = room.players ? room.players[this.myPlayerId] : null;
    const isEntryLocked = (room.meta?.status === "entry" && me && me.listSubmitted);
    const isPlaying = (room.meta?.status === "playing");
    const show = !!(isEntryLocked || isPlaying);
    this.btnHeaderMyList?.classList.toggle("hidden", !show);
    
    // Lightbulb HINTS button is ONLY visible to the player whose active turn it currently is
    const activePlayerId = room.game?.activePlayerId || (room.game?.turnOrder ? room.game.turnOrder[room.game.currentTurnIndex || 0] : null);
    const isMyTurn = (isPlaying && activePlayerId === this.myPlayerId);
    this.btnHeaderHints?.classList.toggle("hidden", !isMyTurn);
    if (!isMyTurn && !this.isRespondingToHintRequest && this.modalHintsHub?.classList.contains("open")) {
      this.closeHintsHubModal();
    }

    // If modal is currently open, live update its slots or requests
    if (this.modalHintsHub?.classList.contains("open")) {
      if (this.activeHintHubTab === "give") {
        this.renderHintsHubSlots();
      } else if (this.activeHintHubTab === "request") {
        this.renderHintRequestPane();
      }
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
    this.lobbyRoomCode.innerHTML = `${room.meta.code} <span class="tap-copy-badge">TAP TO COPY</span>`;
    const players = Object.values(room.players || {});
    const playerCount = players.length;

    this.lobbyPlayerCount.textContent = `${playerCount} / MIN 2`;

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

    // Custom Category Box
    if (room.meta.category === "custom") {
      this.customCategoryBox.classList.remove("hidden");
      const currentTitle = room.meta.customCategory || "";
      if (this.isHost) {
        this.inputCustomCategoryTitle.disabled = false;
        this.btnSaveCustomCategory.classList.remove("hidden");
        if (!this.inputCustomCategoryTitle.matches(":focus")) {
          this.inputCustomCategoryTitle.value = currentTitle;
        }
        this.customCategoryStatus.textContent = currentTitle.trim() ? "TOPIC SET" : "REQUIRED";
        this.customCategoryStatus.className = currentTitle.trim() ? "badge badge-success" : "badge badge-accent";
        this.customCategoryDisplayNote.classList.add("hidden");
      } else {
        this.inputCustomCategoryTitle.disabled = true;
        this.inputCustomCategoryTitle.value = currentTitle || "Custom Topic";
        this.btnSaveCustomCategory.classList.add("hidden");
        this.customCategoryStatus.textContent = "HOST CHOICE";
        this.customCategoryStatus.className = "badge";
        this.customCategoryDisplayNote.textContent = currentTitle 
          ? `Host topic: "${currentTitle}"` 
          : "Host is choosing a topic...";
        this.customCategoryDisplayNote.classList.remove("hidden");
      }
    } else {
      this.customCategoryBox.classList.add("hidden");
    }

    if (this.isHost) {
      this.categoryBadgeNote.textContent = "HOST SELECTS";
    } else {
      this.categoryBadgeNote.textContent = "HOST SELECTION";
    }

    // Render roster
    const hostId = this.getRoomHostId(room);
    this.lobbyPlayerList.innerHTML = "";
    players.forEach(p => {
      const item = document.createElement("div");
      const isThisPlayerHost = (p.id === hostId);
      item.className = "roster-item" + (p.id === this.myPlayerId ? " is-me" : "") + (isThisPlayerHost ? " is-host" : "");

      const isHostTag = isThisPlayerHost ? '<span class="badge badge-accent">HOST</span>' : '';
      const isYouTag = p.id === this.myPlayerId ? '<span class="badge">YOU</span>' : '';
      const isKickable = this.isHost && (this.myPlayerId === hostId) && p.id !== this.myPlayerId && p.id !== hostId;

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

    // Solo lobby disconnect policy: if <= 1 connected player in lobby, register onDisconnect().remove() on whole room
    if (this.isHost && this.currentRoomCode) {
      const connectedCount = players.filter(p => p.connected !== false).length;
      if (connectedCount <= 1) {
        db.registerSoloLobbyDisconnect(this.currentRoomCode);
      } else {
        db.cancelSoloLobbyDisconnect(this.currentRoomCode);
      }
    }

    // Min players check (2 minimum required)
    const canStart = playerCount >= 2;
    if (this.isHost) {
      this.btnStartMatch.disabled = !canStart;
      this.btnStartMatch.textContent = canStart ? "Start Match" : "Need 2+ Players";
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
    await this.touchRoomActivity();
  }

  async saveCustomCategoryTitle() {
    if (!this.isHost || !this.currentRoomCode) return;
    const title = this.inputCustomCategoryTitle.value.trim();
    if (!title) {
      this.showAlert("Please type a topic title.");
      this.inputCustomCategoryTitle.focus();
      return;
    }
    await db.update(`rooms/${this.currentRoomCode}/meta`, {
      customCategory: title
    });
    await this.touchRoomActivity();
    this.showAlert(`Custom topic set to: ${title}`);
  }

  autoSaveCustomCategory() {
    if (!this.isHost || !this.currentRoomCode) return;
    const title = this.inputCustomCategoryTitle.value.trim();
    if (this.customCategoryAutoSaveTimeout) {
      clearTimeout(this.customCategoryAutoSaveTimeout);
    }
    this.customCategoryAutoSaveTimeout = setTimeout(async () => {
      if (!this.currentRoomCode) return;
      await db.update(`rooms/${this.currentRoomCode}/meta`, {
        customCategory: title
      });
      await this.touchRoomActivity();
    }, 600);
  }

  async handleStartMatch() {
    if (!this.isHost || !this.currentRoomCode) return;
    const players = Object.values(this.roomData.players || {}).filter(p => !p.left);
    if (players.length < 2) {
      this.showAlert("Minimum 2 players required to start the match.");
      return;
    }

    if (this.roomData.meta?.category === "custom" && !(this.roomData.meta?.customCategory || "").trim()) {
      this.showAlert("Please enter a custom topic title before starting.");
      if (this.inputCustomCategoryTitle) this.inputCustomCategoryTitle.focus();
      return;
    }

    await db.cancelSoloLobbyDisconnect(this.currentRoomCode);
    await db.update(`rooms/${this.currentRoomCode}/meta`, { status: "entry" });
    await this.touchRoomActivity();
  }

  handleKickPlayer(kickedPlayerId, kickedPlayerName) {
    const hostId = this.getRoomHostId(this.roomData);
    if (!this.isHost || !this.currentRoomCode || this.myPlayerId !== hostId || kickedPlayerId === this.myPlayerId || kickedPlayerId === hostId) {
      return;
    }
    this.showConfirmModal({
      title: "REMOVE PLAYER",
      message: `Remove ${kickedPlayerName} from the room?`,
      confirmText: "KICK PLAYER",
      confirmClass: "btn-danger",
      onConfirm: () => this.executeKickPlayer(kickedPlayerId, kickedPlayerName)
    });
  }

  async executeKickPlayer(kickedPlayerId, kickedPlayerName) {
    const hostId = this.getRoomHostId(this.roomData);
    if (!this.isHost || !this.currentRoomCode || this.myPlayerId !== hostId || kickedPlayerId === this.myPlayerId || kickedPlayerId === hostId) {
      return;
    }

    const room = this.roomData;
    if (!room || !room.players || !room.players[kickedPlayerId]) return;

    await db.remove(`rooms/${this.currentRoomCode}/players/${kickedPlayerId}`);
    await db.remove(`rooms/${this.currentRoomCode}/lists/${kickedPlayerId}`);
    await this.touchRoomActivity();

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

  copyRoomCodeOnly() {
    if (!this.currentRoomCode) return;
    const code = this.currentRoomCode.toUpperCase();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this.showAlert(`COPIED CODE: ${code}`);
      }).catch(() => {
        this.copyFallback(code, `COPIED CODE: ${code}`);
      });
    } else {
      this.copyFallback(code, `COPIED CODE: ${code}`);
    }
  }

  copyRoomInviteLink() {
    if (!this.currentRoomCode) return;
    const inviteUrl = this.getRoomUrl(this.currentRoomCode);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showAlert("COPIED INVITE LINK");
      }).catch(() => {
        this.copyFallback(inviteUrl, "COPIED INVITE LINK");
      });
    } else {
      this.copyFallback(inviteUrl, "COPIED INVITE LINK");
    }
  }

  copyFallback(text, alertMsg = "COPIED INVITE LINK") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      this.showAlert(alertMsg);
    } catch (err) {}
    document.body.removeChild(ta);
  }

  copyRoomCode() {
    this.copyRoomCodeOnly();
  }

  shareRoomLink() {
    this.copyRoomInviteLink();
  }

  // ==========================================================================
  // VIEW 3: SECRET LIST ENTRY PHASE LOGIC
  // ==========================================================================

  getCategoryTitle(cat, customTitle) {
    if (cat === "singers") return "Singers";
    if (cat === "football") return "Footballers";
    if (cat === "actors") return "Actors";
    if (cat === "clubs") return "Football Clubs";
    if (cat === "countries") return "Countries";
    if (cat === "series") return "Series";
    if (cat === "movies") return "Movies";
    if (cat === "foods") return "Foods";
    if (cat === "custom") {
      return customTitle || this.roomData?.meta?.customCategory || "Custom Topic";
    }
    return "Category";
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

    if (this.isLocalMode) {
      this.handleLocalSubmitSecretList(slots);
      return;
    }

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
        this.restoreCategoryLabel.textContent = this.getCategoryTitle(catKey).toUpperCase();
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
    const hostId = this.getRoomHostId(room);
    const players = Object.values(room.players || {});
    let lockedCount = 0;
    this.entryStatusRoster.innerHTML = "";

    players.forEach(p => {
      if (p.listSubmitted) lockedCount++;
      const item = document.createElement("div");
      item.className = "lock-status-item";
      const isLocked = p.listSubmitted;
      const isKickable = this.isHost && (this.myPlayerId === hostId) && p.id !== this.myPlayerId && p.id !== hostId;

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

    if (this.isLocalMode) {
      this.activeTurnControl.classList.remove("hidden");
      this.passiveTurnBanner.classList.add("hidden");
      const activeP = players[activePlayerId];
      const activeName = activeP ? activeP.name : "Player";
      if (this.activeTurnControlTitle) {
        this.activeTurnControlTitle.textContent = `CURRENT TURN: ${activeName.toUpperCase()}`;
      }
      this.btnActiveSkipTurn?.classList.remove("hidden");
      this.renderTargetPlayerSelector(room);
    } else if (isMyTurn) {
      this.activeTurnControl.classList.remove("hidden");
      this.passiveTurnBanner.classList.add("hidden");
      if (this.activeTurnControlTitle) {
        this.activeTurnControlTitle.textContent = "YOUR TURN: GUESS AN OPPONENT'S ITEM";
      }
      this.btnActiveSkipTurn?.classList.add("hidden");
      this.renderTargetPlayerSelector(room);
    } else {
      this.activeTurnControl.classList.add("hidden");
      this.passiveTurnBanner.classList.remove("hidden");
      const activeP = players[activePlayerId];
      this.passiveActivePlayerName.textContent = activeP ? activeP.name : "Player";
      this.btnHostSkipTurn.classList.toggle("hidden", !this.isHost);
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
  // HOST SKIP TURN LOGIC
  // --------------------------------------------------------------------------

  async hostSkipTurn() {
    if (this.isLocalMode) {
      this.localSkipTurn();
      return;
    }
    if (!this.isHost || !this.currentRoomCode || !this.roomData || this.roomData.meta?.status !== "playing") return;
    const game = this.roomData.game || {};
    const turnOrder = game.turnOrder || [];
    if (!turnOrder || turnOrder.length === 0) return;

    const currentIndex = (typeof game.currentTurnIndex === "number") 
      ? game.currentTurnIndex 
      : ((typeof game.turnIndex === "number") ? game.turnIndex : 0);
    
    const activePlayerId = game.activePlayerId || game.currentTurnPlayerId || turnOrder[currentIndex] || turnOrder[0];
    const activeP = this.roomData.players ? this.roomData.players[activePlayerId] : null;
    const activeName = activeP ? activeP.name : "Player";

    let nextIndex = (currentIndex + 1) % turnOrder.length;
    let nextRound = game.round || 1;
    if (nextIndex === 0) {
      nextRound += 1;
    }

    let attempts = 0;
    while (attempts < turnOrder.length && this.hasNoValidTargets(turnOrder[nextIndex], this.roomData)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
      if (nextIndex === 0) nextRound += 1;
      attempts++;
    }

    const nextActivePlayerId = turnOrder[nextIndex];

    const updates = {
      "game/currentTurnIndex": nextIndex,
      "game/turnIndex": nextIndex,
      "game/activePlayerId": nextActivePlayerId,
      "game/currentTurnPlayerId": nextActivePlayerId,
      "game/round": nextRound,
      "game/confirmation": null,
      "game/waiting_for_confirmation": null,
      "game/pendingGuess": null,
      "game/lastAction": {
        text: `Host skipped ${activeName}'s turn.`,
        type: "skip",
        timestamp: Date.now()
      },
      "lastActivity": Date.now()
    };

    await db.update(`rooms/${this.currentRoomCode}`, updates);
    this.showAlert(`Host skipped ${activeName}'s turn.`, "skip");
  }

  handleHostSkipTurn() {
    this.hostSkipTurn();
  }

  executeSkipTurn(activePlayerId, activePlayerName) {
    this.hostSkipTurn();
  }

  // --------------------------------------------------------------------------
  // TARGET SELECTOR & GUESS CONTROLS
  // --------------------------------------------------------------------------

  renderMissedGuesses(boxEl, listEl, missedList) {
    if (!boxEl || !listEl) return;
    if (!missedList || missedList.length === 0) {
      boxEl.classList.add("hidden");
      listEl.innerHTML = "";
      return;
    }
    boxEl.classList.remove("hidden");
    listEl.innerHTML = missedList.map(item => `
      <span class="missed-guess-tag">${this.escapeHtml(item)}</span>
    `).join("");
  }

  renderTargetPlayerSelector(room) {
    const players = room.players || {};
    const lists = room.lists || {};
    const currentTurnPlayerId = this.isLocalMode ? (room.game?.activePlayerId || this.myPlayerId) : this.myPlayerId;
    const opponentIds = Object.keys(players).filter(id => id !== currentTurnPlayerId && !players[id].left);

    // 1. If selectedTargetId points to a completed/invalid player or self, reset it
    const currentSelectedId = this.selectedTargetId || this.selectedTargetPlayerId;
    if (currentSelectedId && (
      currentSelectedId === currentTurnPlayerId ||
      !players[currentSelectedId] ||
      players[currentSelectedId].left ||
      this.isPlayerListCompleted(currentSelectedId, lists)
    )) {
      this.selectedTargetId = null;
      this.selectedTargetPlayerId = null;
    }

    // 2. Default selectedTargetId to the first valid opponent if none selected
    if (!this.selectedTargetId && !this.selectedTargetPlayerId) {
      const firstValid = opponentIds.find(id => !this.isPlayerListCompleted(id, lists));
      if (firstValid) {
        this.selectedTargetId = firstValid;
        this.selectedTargetPlayerId = firstValid;
      }
    }

    const activeTargetId = this.selectedTargetId || this.selectedTargetPlayerId;

    // Sync lower Opponent List Card view if viewingPlayerId is unset or invalid
    if (!this.isViewingMySecretList && (!this.viewingPlayerId || !players[this.viewingPlayerId] || players[this.viewingPlayerId].left)) {
      this.viewingPlayerId = activeTargetId;
    }

    this.targetPlayerGrid.innerHTML = "";
    opponentIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      const isCompleted = this.isPlayerListCompleted(id, lists);
      const isSelected = (id === activeTargetId && !isCompleted);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `target-btn target-player-btn ${isSelected ? 'selected active' : ''} ${isCompleted ? 'disabled' : ''}`;
      btn.dataset.playerId = id;

      const badgeText = isCompleted ? 'DONE' : (isSelected ? 'SELECTED ✓' : 'TARGET');
      const badgeStyle = isSelected ? 'style="color: #FF4D00; font-weight: 800; font-size: 11px;"' : 'style="font-size: 11px;"';

      btn.innerHTML = `
        <span class="target-player-name">${this.escapeHtml(p.name)}</span>
        <span class="mono target-badge" ${badgeStyle}>${badgeText}</span>
      `;

      if (!isCompleted) {
        btn.addEventListener("click", () => {
          // 1. Set selectedTargetId = clickedPlayerId
          this.selectedTargetId = id;
          this.selectedTargetPlayerId = id;

          // 2. Immediately loop through all target player buttons in the Turn Control box:
          // remove .selected / .active from all of them, and add .selected / .active to the clicked button.
          const allTargetBtns = this.targetPlayerGrid.querySelectorAll(".target-btn, .target-player-btn");
          allTargetBtns.forEach(b => {
            const isThisOne = (b.dataset.playerId === id || b === btn);
            if (isThisOne) {
              b.classList.add("selected", "active");
            } else {
              b.classList.remove("selected", "active");
            }
            const badge = b.querySelector(".target-badge, .mono");
            if (badge) {
              if (b.classList.contains("disabled")) {
                badge.textContent = "DONE";
                badge.style.color = "";
                badge.style.fontWeight = "";
              } else if (isThisOne) {
                badge.textContent = "SELECTED ✓";
                badge.style.color = "#FF4D00";
                badge.style.fontWeight = "800";
              } else {
                badge.textContent = "TARGET";
                badge.style.color = "";
                badge.style.fontWeight = "";
              }
            }
          });

          // 3. Also sync the lower Opponent List Card view to switch to that selected opponent's list tab automatically so the player sees the board of the person they are targeting!
          this.viewingPlayerId = id;
          this.isViewingMySecretList = false;
          this.btnToggleMyList?.classList.remove("active");

          // Sync missed guesses box for newly selected target
          if (players[id]) {
            const targetP = players[id];
            const missedList = targetP.missedGuesses 
              ? (Array.isArray(targetP.missedGuesses) ? targetP.missedGuesses : Object.values(targetP.missedGuesses))
              : [];
            this.renderMissedGuesses(this.targetMissedGuessesBox, this.targetMissedGuessesList, missedList);
          }

          this.renderPlayerTabs(room);
          this.renderBoardSlots(room);
          this.updateSubmitButtonState();
        });
      }

      this.targetPlayerGrid.appendChild(btn);
    });

    // Render missed guesses on the targeted player
    if (activeTargetId && players[activeTargetId]) {
      const targetP = players[activeTargetId];
      const missedList = targetP.missedGuesses 
        ? (Array.isArray(targetP.missedGuesses) ? targetP.missedGuesses : Object.values(targetP.missedGuesses))
        : [];
      this.renderMissedGuesses(this.targetMissedGuessesBox, this.targetMissedGuessesList, missedList);
    } else {
      this.targetMissedGuessesBox.classList.add("hidden");
    }

    this.updateSubmitButtonState();
  }

  renderTurnControls(room) {
    this.renderTargetPlayerSelector(room);
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
    const hasTarget = !!(this.selectedTargetId || this.selectedTargetPlayerId);
    this.btnSubmitGuess.disabled = !hasTarget || guessText.length === 0;
  }

  // --------------------------------------------------------------------------
  // 3-LAYER VERIFICATION ENGINE & TURN ADVANCEMENT
  // --------------------------------------------------------------------------

  async handleSubmitTurnGuess() {
    const targetPlayerId = this.selectedTargetId || this.selectedTargetPlayerId;
    const guessText = this.inputTurnGuess.value.trim();

    if (!targetPlayerId || !guessText) return;

    const targetList = this.roomData.lists ? this.roomData.lists[targetPlayerId] : null;
    const targetPlayer = this.roomData.players ? this.roomData.players[targetPlayerId] : null;
    const myPlayer = this.roomData.players ? this.roomData.players[this.myPlayerId] : null;

    if (!targetList || !targetPlayer || !myPlayer) return;

    if (this.isPlayerListCompleted(targetPlayerId, this.roomData.lists)) {
      this.showAlert("This player's list is already 100% complete! Choose another target.");
      return;
    }

    const normGuess = normalizeText(guessText);

    // Prevent duplicate wrong guesses on this target player
    const missedList = targetPlayer.missedGuesses 
      ? (Array.isArray(targetPlayer.missedGuesses) ? targetPlayer.missedGuesses : Object.values(targetPlayer.missedGuesses))
      : [];
    const alreadyMissed = missedList.some(item => normalizeText(item) === normGuess);
    if (alreadyMissed) {
      this.showAlert("Already guessed on this player! Pick another name.");
      return;
    }

    // Reset input
    this.inputTurnGuess.value = "";
    this.turnAutocompleteDropdown.classList.remove("open");
    this.btnSubmitGuess.disabled = true;

    // Filter unrevealed slots on target's list
    const unrevealedSlots = [];
    for (let r = 1; r <= 10; r++) {
      if (targetList[r] && !targetList[r].revealed) {
        unrevealedSlots.push({ rank: r, ...targetList[r] });
      }
    }

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
    if (this.isLocalMode) {
      this.showLocalVerifyChoiceModal(guessText, targetPlayerId, this.myPlayerId);
      return;
    }

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

    if (this.isLocalMode) {
      this.applyLocalCorrectGuess(slot, targetPlayerId, targetPlayerName, guesserPlayer);
      return;
    }

    const guesserId = guesserPlayer.id || this.myPlayerId;
    const newGuesserGuesses = (guesserPlayer.correctGuesses || 0) + 1;

    const updates = {};
    updates[`lists/${targetPlayerId}/${slot.rank}/revealed`] = true;
    updates[`lists/${targetPlayerId}/${slot.rank}/guessedBy`] = guesserPlayer.name;
    updates[`lists/${targetPlayerId}/${slot.rank}/guessedById`] = guesserId;
    updates[`players/${guesserId}/points`] = newGuesserPoints;
    updates[`players/${guesserId}/correctGuesses`] = newGuesserGuesses;
    updates["lastActivity"] = Date.now();

    this.checkAndRecordListCompletion(targetPlayerId, slot.rank, updates, actionText);

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

    // If candidate has no valid opponents with unrevealed picks left to guess on,
    // advance to next player who CAN target someone.
    let attempts = 0;
    while (attempts < turnOrder.length && this.hasNoValidTargets(turnOrder[nextIndex], this.roomData)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
      if (nextIndex === 0) {
        nextRound += 1;
      }
      attempts++;
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
      if (this.modalConfirmation) {
        this.modalConfirmation.classList.remove("open");
        this.modalConfirmation.classList.add("hidden");
      }
      if (this.waitingConfirmationBackdrop) {
        this.waitingConfirmationBackdrop.classList.remove("open");
        this.waitingConfirmationBackdrop.classList.add("hidden");
      }
      return;
    }

    const isTargetPlayer = (confirmation.toPlayerId === this.myPlayerId);

    if (isTargetPlayer) {
      // Show confirmation popup to target player
      if (this.waitingConfirmationBackdrop) {
        this.waitingConfirmationBackdrop.classList.remove("open");
        this.waitingConfirmationBackdrop.classList.add("hidden");
      }
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

      if (this.modalConfirmation) {
        this.modalConfirmation.classList.remove("hidden");
        this.modalConfirmation.classList.add("open");
      }
    } else {
      // Spectator / Guesser waiting screen
      if (this.modalConfirmation) {
        this.modalConfirmation.classList.remove("open");
        this.modalConfirmation.classList.add("hidden");
      }
      this.specTargetName.textContent = confirmation.toPlayerName;
      this.specGuessText.textContent = `"${confirmation.guessText}"`;
      if (this.waitingConfirmationBackdrop) {
        this.waitingConfirmationBackdrop.classList.remove("hidden");
        this.waitingConfirmationBackdrop.classList.add("open");
      }
    }
  }

  async handleConfirmResponse(confirmedRank) {
    const confirmation = this.roomData?.game ? this.roomData.game.confirmation : null;
    if (!confirmation || confirmation.toPlayerId !== this.myPlayerId) return;

    if (this.modalConfirmation) {
      this.modalConfirmation.classList.remove("open");
      this.modalConfirmation.classList.add("hidden");
    }

    const guesserId = confirmation.fromPlayerId;
    const guesserPlayer = this.roomData.players[guesserId];

    if (confirmedRank !== null) {
      // Correct guess confirmed for slot #confirmedRank
      const slot = this.roomData.lists[this.myPlayerId][confirmedRank];
      const points = slot.points;
      const newPoints = (guesserPlayer.points || 0) + points;
      const newGuesses = (guesserPlayer.correctGuesses || 0) + 1;
      const actionText = `${confirmation.fromPlayerName} guessed '${slot.item}' on ${confirmation.toPlayerName}'s list (+${points} pts)`;

      const updates = {};
      updates[`lists/${this.myPlayerId}/${confirmedRank}/revealed`] = true;
      updates[`lists/${this.myPlayerId}/${confirmedRank}/guessedBy`] = confirmation.fromPlayerName;
      updates[`lists/${this.myPlayerId}/${confirmedRank}/guessedById`] = guesserId;
      updates[`players/${guesserId}/points`] = newPoints;
      updates[`players/${guesserId}/correctGuesses`] = newGuesses;
      updates["lastActivity"] = Date.now();

      this.checkAndRecordListCompletion(this.myPlayerId, confirmedRank, updates, actionText);

      await db.update(`rooms/${this.currentRoomCode}`, updates);
    } else {
      // Missed guess ("Not on my list")
      const actionText = `${confirmation.fromPlayerName} missed on ${confirmation.toPlayerName}'s list (0 pts)`;
      const guessText = confirmation.guessText;
      const targetId = confirmation.toPlayerId;
      const targetPlayer = this.roomData.players ? this.roomData.players[targetId] : null;

      const currentMissed = targetPlayer?.missedGuesses 
        ? (Array.isArray(targetPlayer.missedGuesses) ? [...targetPlayer.missedGuesses] : Object.values(targetPlayer.missedGuesses))
        : [];

      const normG = normalizeText(guessText);
      if (!currentMissed.some(mg => normalizeText(mg) === normG)) {
        currentMissed.push(guessText);
      }

      const updates = {
        "game/lastAction": {
          text: actionText,
          type: "danger",
          timestamp: Date.now()
        },
        "lastActivity": Date.now()
      };
      updates[`players/${targetId}/missedGuesses`] = currentMissed;

      await db.update(`rooms/${this.currentRoomCode}`, updates);
    }

    // Advance turn and clear confirmation
    await this.advanceTurn();
  }

  // --------------------------------------------------------------------------
  // BOARD DISPLAY & MY LIST TOGGLE
  // --------------------------------------------------------------------------

  renderPlayerTabs(room) {
    const players = room.players || {};
    const opponentIds = Object.keys(players).filter(id => id !== this.myPlayerId && !players[id].left);

    if (!this.viewingPlayerId && opponentIds.length > 0) {
      this.viewingPlayerId = opponentIds[0];
    }

    const finishedOrder = room.finishedOrder 
      ? (Array.isArray(room.finishedOrder) ? room.finishedOrder : Object.values(room.finishedOrder))
      : [];

    this.playerTabsBar.innerHTML = "";
    opponentIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      const isSelected = (!this.isViewingMySecretList && this.viewingPlayerId === id);
      const finishIndex = finishedOrder.indexOf(id);
      const isCompleted = (finishIndex !== -1) || this.isPlayerListCompleted(id, room.lists || {});

      const tab = document.createElement("button");
      tab.className = `player-tab-btn ${isSelected ? 'active' : ''} ${isCompleted ? 'is-completed' : ''}`;
      
      if (finishIndex !== -1) {
        const badgeText = this.getOrdinalBadge(finishIndex + 1);
        tab.innerHTML = `<span>${this.escapeHtml(p.name)}</span> <span class="badge badge-finish">${badgeText}</span>`;
      } else if (isCompleted) {
        tab.innerHTML = `<span>${this.escapeHtml(p.name)}</span> <span class="badge badge-finish">FINISHED</span>`;
      } else {
        tab.textContent = p.name;
      }

      tab.addEventListener("click", () => {
        this.viewingPlayerId = id;
        this.isViewingMySecretList = false;
        this.btnToggleMyList?.classList.remove("active");
        this.renderPlayerTabs(room);
        this.renderBoardSlots(room);
      });
      this.playerTabsBar.appendChild(tab);
    });
  }

  toggleMySecretList() {
    this.isViewingMySecretList = !this.isViewingMySecretList;
    if (this.isViewingMySecretList) {
      this.btnToggleMyList?.classList.add("active");
      this.viewingPlayerId = this.myPlayerId;
    } else {
      this.btnToggleMyList?.classList.remove("active");
      const opponentIds = Object.keys(this.roomData?.players || {}).filter(id => id !== this.myPlayerId);
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
      const hostId = this.getRoomHostId(room);
      const isKickable = this.isHost && (this.myPlayerId === hostId) && targetId !== this.myPlayerId && targetId !== hostId;
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

    // Render missed guesses on viewed board
    if (!this.isViewingMySecretList && player) {
      const missedList = player.missedGuesses 
        ? (Array.isArray(player.missedGuesses) ? player.missedGuesses : Object.values(player.missedGuesses))
        : [];
      this.renderMissedGuesses(this.boardMissedGuessesBox, this.boardMissedGuessesList, missedList);
    } else {
      this.boardMissedGuessesBox.classList.add("hidden");
    }

    let hiddenCount = 0;
    for (let r = 1; r <= 10; r++) {
      if (list[r] && !list[r].revealed) hiddenCount++;
    }

    const finishedOrder = room.finishedOrder 
      ? (Array.isArray(room.finishedOrder) ? room.finishedOrder : Object.values(room.finishedOrder))
      : [];
    const finishIndex = finishedOrder.indexOf(targetId);

    if (finishIndex !== -1) {
      this.selectedBoardStatusBadge.textContent = this.getOrdinalBadge(finishIndex + 1);
      this.selectedBoardStatusBadge.className = "badge badge-finish";
    } else {
      this.selectedBoardStatusBadge.textContent = `${hiddenCount} / 10 HIDDEN`;
      this.selectedBoardStatusBadge.className = `badge ${hiddenCount === 0 ? 'badge-success' : ''}`;
    }

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
          ? `<button type="button" class="btn btn-sm ${hint ? '' : 'btn-primary'} btn-hint btn-board-hint" data-rank="${r}">[ ${hint ? 'EDIT HINT' : 'DROP HINT'} ]</button>`
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
          btn.addEventListener("click", () => this.openHintsHubModal());
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
          const bulbSvg = `<svg class="icon icon-bulb" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 2px;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>`;
          const hintBadge = hint
            ? `<span class="board-slot-hint-bright">${bulbSvg} 💡 HINT: ${this.escapeHtml(hint.text)}</span>`
            : '';

          itemEl.innerHTML = `
            <div class="board-slot-rank">#${r}</div>
            <div class="board-slot-content">
              <span class="board-slot-name">[ HIDDEN - ${r} PTS ]</span>
              ${hintBadge}
            </div>
            <div class="board-slot-pts">${r} pts</div>
          `;
        }
      }

      this.boardSlotsList.appendChild(itemEl);
    }
  }

  renderStandings(room) {
    const hostId = this.getRoomHostId(room);
    const players = Object.values(room.players || {}).filter(p => !p.left);
    players.sort((a, b) => (b.points || 0) - (a.points || 0));

    this.liveStandingsGrid.innerHTML = "";
    players.forEach(p => {
      const badge = document.createElement("div");
      const isTurn = (p.id === room.game?.activePlayerId);
      const isKickable = this.isHost && (this.myPlayerId === hostId) && p.id !== this.myPlayerId && p.id !== hostId;

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
    const activePlayers = Object.values(room.players || {}).filter(p => !p.left);
    const lists = room.lists || {};

    if (activePlayers.length < 2) return;

    let isGameOver = false;

    if (activePlayers.length === 2) {
      // 1v1 Head-to-Head Rule (Active Players === 2):
      // First player to completely reveal the other player's Top 10 list (55 pts) immediately WINS!
      const anyListCompleted = activePlayers.some(p => this.isPlayerListCompleted(p.id, lists));
      const anyPlayerReached55 = activePlayers.some(p => (p.points || 0) >= 55);
      if (anyListCompleted || anyPlayerReached55) {
        isGameOver = true;
      }
    } else {
      // 3+ Player Multi-Stage Race Rule: Continues until everyone finishes
      const allCompleted = activePlayers.every(p => this.isPlayerListCompleted(p.id, lists));
      if (allCompleted) {
        isGameOver = true;
      }
    }

    if (isGameOver) {
      if (this.isLocalMode) {
        this.localMatch.meta.status = "game_over";
        this.saveLocalMatch(this.localMatch);
        this.renderGameOver(this.localMatch);
        this.switchView("game_over");
        return;
      }
      if (this.isHost) {
        db.update(`rooms/${this.currentRoomCode}/meta`, { status: "game_over" });
      }
    }
  }

  getPlayerCorrectGuesses(player, lists = {}) {
    if (!player) return 0;
    const playerId = player.id;
    const playerName = (player.name || "").trim().toLowerCase();
    let count = 0;

    if (lists && typeof lists === "object") {
      Object.values(lists).forEach(list => {
        if (!list || typeof list !== "object") return;
        for (let r = 1; r <= 10; r++) {
          const slot = list[r];
          if (!slot || !slot.revealed) continue;

          const matchId = slot.guessedById && playerId && (slot.guessedById === playerId);
          const matchName = slot.guessedBy && (slot.guessedBy.trim().toLowerCase() === playerName);

          if (matchId || matchName) {
            count++;
          }
        }
      });
    }

    const storedCount = Number(player.correctGuesses) || 0;
    return Math.max(count, storedCount);
  }

  renderGameOver(room) {
    const lists = room.lists || {};
    const players = Object.values(room.players || {}).filter(p => !p.left);

    // Sort players by:
    // 1. Total points (descending)
    // 2. Total correct guesses (descending as tiebreaker)
    players.sort((a, b) => {
      const ptsA = Number(a.points) || 0;
      const ptsB = Number(b.points) || 0;
      if (ptsB !== ptsA) {
        return ptsB - ptsA;
      }
      const guessesA = this.getPlayerCorrectGuesses(a, lists);
      const guessesB = this.getPlayerCorrectGuesses(b, lists);
      if (guessesB !== guessesA) {
        return guessesB - guessesA;
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    const winner = players[0];
    if (winner) {
      const winnerGuesses = this.getPlayerCorrectGuesses(winner, lists);
      const winnerGuessLabel = winnerGuesses === 1 ? "1 GUESS" : `${winnerGuesses} GUESSES`;
      this.podiumWinnerName.innerHTML = `
        <span class="winner-name-text">${this.escapeHtml(winner.name)}</span>
        <span class="winner-stats-pill">${winner.points || 0} PTS • ${winnerGuessLabel}</span>
      `;
    } else {
      this.podiumWinnerName.textContent = "No Winner";
    }

    // Final leaderboard
    this.finalLeaderboardList.innerHTML = "";
    players.forEach((p, idx) => {
      const pGuesses = this.getPlayerCorrectGuesses(p, lists);
      const guessLabel = pGuesses === 1 ? "1 GUESS" : `${pGuesses} GUESSES`;
      const isYou = (!this.isLocalMode && p.id === this.myPlayerId);
      const row = document.createElement("div");
      row.className = `final-score-row ${idx === 0 ? 'rank-1' : ''}`;
      row.innerHTML = `
        <span class="rank-pos">#${idx + 1}</span>
        <span class="player-label" title="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)} ${isYou ? '<span class="you-badge">(You)</span>' : ''}</span>
        <span class="score-value">
          <span class="score-pts">${p.points || 0} PTS</span>
          <span class="score-sep">•</span>
          <span class="score-guesses">${guessLabel}</span>
        </span>
      `;
      this.finalLeaderboardList.appendChild(row);
    });

    // Full revealed lists for all players
    this.finalAllListsContainer.innerHTML = "";
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
            <span class="mono text-secondary" style="font-size: 11px;">${r} pts ${s.guessedBy ? `(Guessed by ${this.escapeHtml(s.guessedBy)})` : '(Unguessed)'}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 8px;">${this.escapeHtml(p.name)}'s List</div>
        <div>${slotsHtml}</div>
      `;
      this.finalAllListsContainer.appendChild(card);
    });

    // Play Again button (Host only in online, always available in Pass & Play)
    if (this.isLocalMode) {
      this.btnPlayAgain.classList.remove("hidden");
      this.btnPlayAgain.textContent = "PLAY AGAIN (SAME PLAYERS)";
      this.playAgainNote.textContent = "Start a fresh match with the same players.";
    } else if (this.isHost) {
      this.btnPlayAgain.classList.remove("hidden");
      this.btnPlayAgain.textContent = "PLAY AGAIN";
      this.playAgainNote.textContent = "You are the Host. Click below to start a new match in this room.";
    } else {
      this.btnPlayAgain.classList.add("hidden");
      this.playAgainNote.textContent = "Waiting for the Host to start a new match...";
    }
  }

  async handlePlayAgain() {
    if (this.isLocalMode) {
      this.restartLocalMatchSamePlayers();
      return;
    }
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
      "finishedOrder": [],
      "lists": {}
    };

    const players = this.roomData.players || {};
    Object.keys(players).forEach(pid => {
      updates[`players/${pid}/points`] = 0;
      updates[`players/${pid}/correctGuesses`] = 0;
      updates[`players/${pid}/listSubmitted`] = false;
      updates[`players/${pid}/targetCompleted`] = false;
    });

    await db.update(`rooms/${this.currentRoomCode}`, updates);
  }

  // ==========================================================================
  // MY LIST OVERLAY DRAWER
  // ==========================================================================

  toggleMyListDrawer(forceOpen) {
    if (!this.modalMyList) return;
    const shouldOpen = (typeof forceOpen === "boolean") 
      ? forceOpen 
      : !this.modalMyList.classList.contains("open");

    if (shouldOpen) {
      this.renderMyListDrawer();
      this.modalMyList.classList.remove("hidden");
      this.modalMyList.classList.add("open");
      this.btnHeaderMyList?.classList.add("active");
    } else {
      this.modalMyList.classList.remove("open");
      this.modalMyList.classList.add("hidden");
      this.btnHeaderMyList?.classList.remove("active");
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
        const hintBtn = `<button type="button" class="btn btn-sm ${hint ? '' : 'btn-primary'} btn-hint btn-drawer-hint" data-rank="${r}">[ ${hint ? 'EDIT HINT' : 'DROP HINT'} ]</button>`;
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
        btn.addEventListener("click", () => this.openHintsHubModal());
      }

      this.myListDrawerSlots.appendChild(itemEl);
    }
  }

  // ==========================================================================
  // 1-DEVICE (PASS & PLAY) LOCAL MULTIPLAYER ENGINE
  // ==========================================================================

  switchHomeMode(mode) {
    if (mode === "local") {
      this.tabModeLocal?.classList.add("active");
      this.tabModeOnline?.classList.remove("active");
      this.panelModeLocal?.classList.remove("hidden");
      this.panelModeOnline?.classList.add("hidden");
      this.checkLocalMatchSaved();
      this.renderLocalPlayerInputs();
    } else {
      this.tabModeOnline?.classList.add("active");
      this.tabModeLocal?.classList.remove("active");
      this.panelModeOnline?.classList.remove("hidden");
      this.panelModeLocal?.classList.add("hidden");
    }
  }

  adjustLocalPlayerCount(delta) {
    const nextCount = Math.max(2, Math.min(10, this.localPlayerCount + delta));
    if (nextCount === this.localPlayerCount) return;
    this.localPlayerCount = nextCount;
    if (this.localPlayerCountDisplay) {
      this.localPlayerCountDisplay.textContent = this.localPlayerCount;
    }
    this.renderLocalPlayerInputs();
  }

  renderLocalPlayerInputs() {
    if (!this.localPlayerNamesList) return;

    // Collect existing values to avoid wiping typed names
    const existingValues = [];
    for (let i = 1; i <= 10; i++) {
      const inp = document.getElementById(`local-player-name-${i}`);
      if (inp) {
        existingValues.push(inp.value);
      }
    }

    if (this.btnLocalCountMinus) {
      this.btnLocalCountMinus.disabled = (this.localPlayerCount <= 2);
    }
    if (this.btnLocalCountPlus) {
      this.btnLocalCountPlus.disabled = (this.localPlayerCount >= 10);
    }

    this.localPlayerNamesList.innerHTML = "";
    for (let i = 1; i <= this.localPlayerCount; i++) {
      const row = document.createElement("div");
      row.className = "local-name-row";

      const defaultPlaceholder = `Player ${i}`;
      const savedValue = existingValues[i - 1] !== undefined ? existingValues[i - 1] : "";

      row.innerHTML = `
        <span class="local-name-badge">PLAYER ${i}</span>
        <input type="text" class="local-name-input" id="local-player-name-${i}" placeholder="Enter Player ${i} name" maxlength="20" autocomplete="off" value="${this.escapeHtml(savedValue)}">
      `;
      this.localPlayerNamesList.appendChild(row);
    }
  }

  selectLocalCategory(category) {
    if (!category) return;
    this.localCategory = category;
    this.localCategoryBtns.forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.category === category);
    });

    if (this.localCustomCategoryBox) {
      this.localCustomCategoryBox.classList.toggle("hidden", category !== "custom");
      if (category === "custom") {
        this.inputLocalCustomCategoryTitle?.focus();
      }
    }
  }

  checkLocalMatchSaved() {
    if (!this.localReconnectBox) return;
    const raw = localStorage.getItem("ta5mena_local_match");
    if (!raw) {
      this.localReconnectBox.classList.add("hidden");
      return;
    }

    try {
      const match = JSON.parse(raw);
      if (match && match.meta && match.players) {
        const pCount = Object.keys(match.players).length;
        const catTitle = this.getCategoryTitle(match.meta.category, match.meta.customCategory);
        const status = (match.meta.status || "active").toUpperCase();
        if (this.localReconnectInfo) {
          this.localReconnectInfo.textContent = `${pCount} Players • ${catTitle} (${status})`;
        }
        this.localReconnectBox.classList.remove("hidden");
      } else {
        this.localReconnectBox.classList.add("hidden");
      }
    } catch (e) {
      this.localReconnectBox.classList.add("hidden");
    }
  }

  discardLocalMatch() {
    localStorage.removeItem("ta5mena_local_match");
    this.localMatch = null;
    this.isLocalMode = false;
    this.localReconnectBox?.classList.add("hidden");
    this.showAlert("Discarded saved Pass & Play match.");
  }

  resumeLocalMatch() {
    const raw = localStorage.getItem("ta5mena_local_match");
    if (!raw) return;

    try {
      const match = JSON.parse(raw);
      if (!match || !match.players || !match.meta) return;

      this.isLocalMode = true;
      this.localMatch = match;
      this.roomData = match;
      this.currentRoomCode = "LOCAL";
      this.localPlayerIds = Object.keys(match.players);
      this.category = match.meta.category || "singers";

      if (match.meta.status === "entry") {
        // Find first player who has not submitted their list
        const remainingIdx = this.localPlayerIds.findIndex(pid => !match.players[pid].listSubmitted);
        if (remainingIdx === -1) {
          this.startLocalGameTurn();
        } else {
          this.openLocalPlayerListEntry(remainingIdx);
        }
      } else if (match.meta.status === "playing") {
        this.startLocalGameTurn();
      } else if (match.meta.status === "game_over") {
        this.renderGameOver(match);
        this.switchView("game_over");
      }
      this.showAlert("Resumed your Pass & Play match!");
    } catch (e) {
      console.warn("Failed to resume local match:", e);
    }
  }

  startLocalMatch() {
    const names = [];
    for (let i = 1; i <= this.localPlayerCount; i++) {
      const inp = document.getElementById(`local-player-name-${i}`);
      const name = (inp?.value || "").trim();
      names.push(name);
    }

    // Validation 1: All names filled
    const hasEmpty = names.some(n => n.length === 0);
    if (hasEmpty) {
      if (this.localSetupErrorBanner) {
        this.localSetupErrorBanner.textContent = `Please enter a name for all ${this.localPlayerCount} players.`;
        this.localSetupErrorBanner.classList.remove("hidden");
      }
      return;
    }

    // Validation 2: No duplicate names (case-insensitive)
    const seenNames = new Set();
    for (const name of names) {
      const lower = name.toLowerCase();
      if (seenNames.has(lower)) {
        if (this.localSetupErrorBanner) {
          this.localSetupErrorBanner.textContent = `All player names must be unique. Duplicate: "${name}"`;
          this.localSetupErrorBanner.classList.remove("hidden");
        }
        return;
      }
      seenNames.add(lower);
    }

    // Validation 3: Custom topic title if custom category is selected
    const customTitle = (this.inputLocalCustomCategoryTitle?.value || "").trim();
    if (this.localCategory === "custom" && !customTitle) {
      if (this.localSetupErrorBanner) {
        this.localSetupErrorBanner.textContent = "Please enter a custom topic title before starting.";
        this.localSetupErrorBanner.classList.remove("hidden");
      }
      this.inputLocalCustomCategoryTitle?.focus();
      return;
    }

    this.localSetupErrorBanner?.classList.add("hidden");

    // Build player nodes
    const players = {};
    const pids = [];
    names.forEach((name, idx) => {
      const pid = `lp_${idx + 1}_${Date.now().toString(36).slice(-4)}`;
      pids.push(pid);
      players[pid] = {
        id: pid,
        name: name,
        points: 0,
        correctGuesses: 0,
        listSubmitted: false,
        targetCompleted: false,
        missedGuesses: [],
        hints: {}
      };
    });

    const match = {
      meta: {
        code: "LOCAL",
        mode: "local",
        category: this.localCategory,
        customCategory: this.localCategory === "custom" ? customTitle : "",
        status: "entry",
        createdAt: Date.now()
      },
      players: players,
      lists: {},
      finishedOrder: [],
      game: {
        turnOrder: [],
        currentTurnIndex: 0,
        activePlayerId: null,
        round: 1,
        lastAction: null,
        confirmation: null
      }
    };

    this.isLocalMode = true;
    this.localMatch = match;
    this.roomData = match;
    this.currentRoomCode = "LOCAL";
    this.localPlayerIds = pids;
    this.localCurrentEntryIndex = 0;
    this.category = this.localCategory;
    this.saveLocalMatch(match);

    this.openLocalPlayerListEntry(0);
  }

  saveLocalMatch(match) {
    this.localMatch = match;
    this.roomData = match;
    try {
      localStorage.setItem("ta5mena_local_match", JSON.stringify(match));
    } catch (e) {
      console.warn("Error saving local match:", e);
    }
  }

  showPrivacyCurtain(playerName, actionTitle, onProceed) {
    if (!this.modalPrivacyCurtain) return;
    if (this.privacyCurtainPlayerName) {
      this.privacyCurtainPlayerName.textContent = playerName.toUpperCase();
    }
    if (this.privacyCurtainActionName) {
      this.privacyCurtainActionName.textContent = actionTitle;
    }
    this.localCurtainProceedCallback = onProceed;
    this.modalPrivacyCurtain.classList.remove("hidden");
    this.modalPrivacyCurtain.classList.add("open");
  }

  closePrivacyCurtain() {
    if (this.modalPrivacyCurtain) {
      this.modalPrivacyCurtain.classList.remove("open");
      this.modalPrivacyCurtain.classList.add("hidden");
    }
  }

  handlePrivacyCurtainProceed() {
    const cb = this.localCurtainProceedCallback;
    this.localCurtainProceedCallback = null;
    this.closePrivacyCurtain();
    if (cb) cb();
  }

  openLocalPlayerListEntry(playerIndex) {
    if (playerIndex >= this.localPlayerIds.length) {
      // All players locked in
      this.finishAllLocalLists();
      return;
    }

    this.localCurrentEntryIndex = playerIndex;
    const pid = this.localPlayerIds[playerIndex];
    const player = this.localMatch.players[pid];

    // Wipe any leftover text from inputs immediately before showing privacy curtain
    for (let r = 1; r <= 10; r++) {
      const input = document.getElementById(`entry-slot-input-${r}`);
      if (input) input.value = "";
      const dd = document.getElementById(`autocomplete-slot-${r}`);
      if (dd) { dd.innerHTML = ""; dd.classList.remove("open"); }
    }

    this.showPrivacyCurtain(
      player.name,
      `ENTER MY LIST`,
      () => {
        this.myPlayerId = pid;
        this.myPlayerName = player.name;
        this.category = this.localMatch.meta.category;

        this.switchView("entry");
        const catTitle = this.getCategoryTitle(this.localMatch.meta.category, this.localMatch.meta.customCategory);
        if (this.entryCategoryTitle) {
          this.entryCategoryTitle.textContent = `${player.name}'s Top 10: ${catTitle}`;
        }

        if (this.entrySlotsContainer.children.length === 0) {
          this.buildEntrySlots();
        }

        // Restore if player already saved draft
        const existingList = this.localMatch.lists[pid];
        for (let r = 1; r <= 10; r++) {
          const input = document.getElementById(`entry-slot-input-${r}`);
          if (input) {
            input.disabled = false;
            input.value = (existingList && existingList[r]) ? existingList[r].item : "";
          }
        }

        if (this.restoreBanner) this.restoreBanner.classList.add("hidden");
        if (this.entryWaitingCard) this.entryWaitingCard.classList.add("hidden");

        this.btnSubmitList.disabled = false;
        this.btnSubmitList.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          LOCK IN LIST & PASS PHONE
        `;
      }
    );
  }

  handleLocalSubmitSecretList(slots) {
    this.localMatch.lists[this.myPlayerId] = slots;
    this.localMatch.players[this.myPlayerId].listSubmitted = true;

    // Immediately wipe inputs from screen to prevent next player from seeing
    for (let r = 1; r <= 10; r++) {
      const input = document.getElementById(`entry-slot-input-${r}`);
      if (input) input.value = "";
      const dd = document.getElementById(`autocomplete-slot-${r}`);
      if (dd) { dd.innerHTML = ""; dd.classList.remove("open"); }
    }

    this.saveLocalMatch(this.localMatch);

    const nextIndex = this.localCurrentEntryIndex + 1;
    if (nextIndex < this.localPlayerIds.length) {
      this.openLocalPlayerListEntry(nextIndex);
    } else {
      this.finishAllLocalLists();
    }
  }

  finishAllLocalLists() {
    // Randomize turn order
    const pids = [...this.localPlayerIds];
    for (let i = pids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pids[i], pids[j]] = [pids[j], pids[i]];
    }

    this.localMatch.meta.status = "playing";
    this.localMatch.game.turnOrder = pids;
    this.localMatch.game.currentTurnIndex = 0;
    this.localMatch.game.activePlayerId = pids[0];
    this.localMatch.game.round = 1;
    this.localMatch.game.lastAction = {
      text: `Pass & Play match started! ${this.localMatch.players[pids[0]].name}'s turn to guess.`,
      timestamp: Date.now()
    };
    this.saveLocalMatch(this.localMatch);
    this.showFloatingNotification("All lists locked in! Turns randomized.", "milestone");
    this.startLocalGameTurn();
  }

  startLocalGameTurn() {
    const game = this.localMatch.game;
    const turnOrder = game.turnOrder || this.localPlayerIds;
    const activePlayerId = game.activePlayerId || turnOrder[game.currentTurnIndex || 0];
    const activePlayer = this.localMatch.players[activePlayerId];

    this.myPlayerId = activePlayerId;
    this.myPlayerName = activePlayer ? activePlayer.name : "Player";
    this.selectedTargetId = null;
    this.selectedTargetPlayerId = null;
    this.viewingPlayerId = null;
    this.isViewingMySecretList = false;

    // Reset guess input
    if (this.inputTurnGuess) {
      this.inputTurnGuess.value = "";
    }
    if (this.btnSubmitGuess) {
      this.btnSubmitGuess.disabled = true;
    }

    this.switchView("game");
    this.renderMainGame(this.localMatch);
    this.updateMyListButtonVisibility(this.localMatch);
  }

  applyLocalCorrectGuess(slot, targetPlayerId, targetPlayerName, guesserPlayer) {
    const pointsAwarded = slot.points;
    const newGuesserPoints = (guesserPlayer.points || 0) + pointsAwarded;
    const newGuesserGuesses = (guesserPlayer.correctGuesses || 0) + 1;

    slot.revealed = true;
    slot.guessedBy = guesserPlayer.name;
    slot.guessedById = guesserPlayer.id;
    guesserPlayer.points = newGuesserPoints;
    guesserPlayer.correctGuesses = newGuesserGuesses;

    const actionText = `${guesserPlayer.name} guessed '${slot.item}' on ${targetPlayerName}'s list (+${pointsAwarded} pts)`;

    // Check target list completion
    const targetList = this.localMatch.lists[targetPlayerId] || {};
    let allRevealed = true;
    for (let r = 1; r <= 10; r++) {
      if (!targetList[r] || !targetList[r].revealed) {
        allRevealed = false;
        break;
      }
    }

    const activeLocalPlayers = Object.keys(this.localMatch.players || {});
    const is2PlayerLocal = (activeLocalPlayers.length === 2);

    let milestoneAnnouncement = null;
    if (allRevealed) {
      if (is2PlayerLocal || newGuesserPoints >= 55) {
        this.localMatch.meta.status = "game_over";
        this.localMatch.game.lastAction = {
          text: `${guesserPlayer.name} finished ${targetPlayerName}'s list (55 pts) and WINS the match!`,
          type: "milestone",
          timestamp: Date.now()
        };
        this.saveLocalMatch(this.localMatch);
        this.renderGameOver(this.localMatch);
        this.switchView("game_over");
        return;
      }

      if (!this.localMatch.finishedOrder) this.localMatch.finishedOrder = [];
      if (!this.localMatch.finishedOrder.includes(targetPlayerId)) {
        this.localMatch.finishedOrder.push(targetPlayerId);
        const placeNum = this.localMatch.finishedOrder.length;
        const placeText = this.getOrdinalPlace(placeNum);
        milestoneAnnouncement = `${targetPlayerName}'s list is 100% complete (${placeText})! The game continues until everyone finishes!`;
      }
    }

    this.localMatch.game.lastAction = {
      text: milestoneAnnouncement || actionText,
      type: milestoneAnnouncement ? "milestone" : "success",
      timestamp: Date.now()
    };

    this.saveLocalMatch(this.localMatch);
    this.showFloatingNotification(milestoneAnnouncement || actionText, milestoneAnnouncement ? "milestone" : "success");

    // Check if entire match is finished
    const allLists = this.localMatch.lists || {};
    let isLocalGameOver = false;
    if (is2PlayerLocal) {
      const anyReached55 = activeLocalPlayers.some(pid => (this.localMatch.players[pid]?.points || 0) >= 55);
      const anyCompleted = activeLocalPlayers.some(pid => this.isPlayerListCompleted(pid, allLists));
      if (anyReached55 || anyCompleted) isLocalGameOver = true;
    } else {
      isLocalGameOver = activeLocalPlayers.every(pid => {
        const pList = allLists[pid] || {};
        for (let r = 1; r <= 10; r++) {
          if (!pList[r] || !pList[r].revealed) return false;
        }
        return true;
      });
    }

    if (isLocalGameOver) {
      this.localMatch.meta.status = "game_over";
      this.saveLocalMatch(this.localMatch);
      this.renderGameOver(this.localMatch);
      this.switchView("game_over");
      return;
    }

    this.advanceLocalTurn();
  }

  advanceLocalTurn() {
    const game = this.localMatch.game;
    const turnOrder = game.turnOrder || this.localPlayerIds;
    let nextIndex = (game.currentTurnIndex + 1) % turnOrder.length;
    let nextRound = game.round || 1;

    if (nextIndex === 0) {
      nextRound += 1;
    }

    let attempts = 0;
    while (attempts < turnOrder.length && this.hasNoValidTargets(turnOrder[nextIndex], this.localMatch)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
      if (nextIndex === 0) nextRound += 1;
      attempts++;
    }

    const nextActivePlayerId = turnOrder[nextIndex];
    game.currentTurnIndex = nextIndex;
    game.activePlayerId = nextActivePlayerId;
    game.round = nextRound;
    game.confirmation = null;

    this.saveLocalMatch(this.localMatch);
    this.startLocalGameTurn();
  }

  localSkipTurn() {
    const game = this.localMatch.game;
    const activePlayer = this.localMatch.players[game.activePlayerId];
    const activeName = activePlayer ? activePlayer.name : "Player";

    this.localMatch.game.lastAction = {
      text: `${activeName}'s turn was skipped.`,
      type: "skip",
      timestamp: Date.now()
    };
    this.showFloatingNotification(`${activeName}'s turn was skipped.`, "skip");
    this.advanceLocalTurn();
  }

  showLocalVerifyChoiceModal(guessText, targetPlayerId, guesserPlayerId) {
    this.localPendingVerify = { guessText, targetPlayerId, guesserPlayerId };
    const targetPlayer = this.localMatch.players[targetPlayerId];
    const guesserPlayer = this.localMatch.players[guesserPlayerId];
    const targetList = this.localMatch.lists[targetPlayerId] || {};

    if (this.localVerifyChoiceGuessText) {
      this.localVerifyChoiceGuessText.textContent = `"${guessText}"`;
    }
    if (this.localVerifyChoiceGuesserName) {
      this.localVerifyChoiceGuesserName.textContent = guesserPlayer ? guesserPlayer.name : "Guesser";
    }
    if (this.localVerifyChoiceTargetName) {
      this.localVerifyChoiceTargetName.textContent = targetPlayer ? targetPlayer.name : "Target";
    }
    if (this.localVerifyChoiceTargetBadge) {
      this.localVerifyChoiceTargetBadge.textContent = `TARGET: ${targetPlayer ? targetPlayer.name.toUpperCase() : 'TARGET'}`;
    }
    if (this.localVerifySecretTargetBtnLabel) {
      this.localVerifySecretTargetBtnLabel.textContent = targetPlayer ? targetPlayer.name.toUpperCase() : "TARGET";
    }

    // Populate Option A oral rank buttons (#1 to #10)
    if (this.localVerifyOralRanksContainer) {
      this.localVerifyOralRanksContainer.innerHTML = "";
      for (let r = 1; r <= 10; r++) {
        const slot = targetList[r];
        const isRevealed = slot && slot.revealed;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-rank-check";
        btn.disabled = !!isRevealed;
        btn.innerHTML = `#${r}<div style="font-size: 10px; opacity: 0.85;">${r}pt</div>`;

        if (!isRevealed) {
          btn.addEventListener("click", () => this.handleLocalOralRankCheck(r));
        }
        this.localVerifyOralRanksContainer.appendChild(btn);
      }
    }

    if (this.modalLocalVerifyChoice) {
      this.modalLocalVerifyChoice.classList.remove("hidden");
      this.modalLocalVerifyChoice.classList.add("open");
    }
  }

  closeLocalVerifyChoiceModal() {
    if (this.modalLocalVerifyChoice) {
      this.modalLocalVerifyChoice.classList.remove("open");
      this.modalLocalVerifyChoice.classList.add("hidden");
    }
  }

  handleLocalOralRankCheck(rank) {
    if (!this.localPendingVerify) return;
    const { targetPlayerId, guesserPlayerId } = this.localPendingVerify;
    const targetPlayer = this.localMatch.players[targetPlayerId];
    const guesserPlayer = this.localMatch.players[guesserPlayerId];
    const targetList = this.localMatch.lists[targetPlayerId] || {};
    const slot = targetList[rank];

    this.closeLocalVerifyChoiceModal();
    if (slot && !slot.revealed) {
      this.applyLocalCorrectGuess(slot, targetPlayerId, targetPlayer.name, guesserPlayer);
    }
    this.localPendingVerify = null;
  }

  handleLocalVerifyWrong() {
    if (!this.localPendingVerify) return;
    const { guessText, targetPlayerId, guesserPlayerId } = this.localPendingVerify;
    const targetPlayer = this.localMatch.players[targetPlayerId];
    const guesserPlayer = this.localMatch.players[guesserPlayerId];

    if (targetPlayer) {
      if (!targetPlayer.missedGuesses) targetPlayer.missedGuesses = [];
      targetPlayer.missedGuesses.push(guessText);
    }

    this.closeLocalVerifyChoiceModal();
    this.closeLocalSecretTargetSlotsModal();

    const actionText = `${guesserPlayer ? guesserPlayer.name : 'Player'} missed on ${targetPlayer ? targetPlayer.name : 'Target'}'s list.`;
    this.localMatch.game.lastAction = {
      text: actionText,
      type: "danger",
      timestamp: Date.now()
    };
    this.saveLocalMatch(this.localMatch);
    this.showFloatingNotification(actionText, "danger");

    this.localPendingVerify = null;
    this.advanceLocalTurn();
  }

  openLocalSecretVerifyForTarget() {
    if (!this.localPendingVerify) return;
    const { guessText, targetPlayerId, guesserPlayerId } = this.localPendingVerify;
    const targetPlayer = this.localMatch.players[targetPlayerId];
    const guesserPlayer = this.localMatch.players[guesserPlayerId];
    const targetList = this.localMatch.lists[targetPlayerId] || {};

    this.closeLocalVerifyChoiceModal();

    // Show Privacy Curtain for target player
    this.showPrivacyCurtain(
      targetPlayer.name,
      `CHECK MY LIST`,
      () => {
        if (this.localSecretSlotsPlayerName) {
          this.localSecretSlotsPlayerName.textContent = `${targetPlayer.name}'s Secret List`;
        }
        if (this.localSecretSlotsGuessText) {
          this.localSecretSlotsGuessText.textContent = `"${guessText}"`;
        }

        // Render target's unguessed slots
        if (this.localSecretSlotsList) {
          this.localSecretSlotsList.innerHTML = "";
          for (let r = 1; r <= 10; r++) {
            const slot = targetList[r];
            if (!slot || slot.revealed) continue;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "secret-target-slot-btn";
            btn.innerHTML = `
              <span class="secret-target-slot-rank">#${r} (${r} ${r === 1 ? 'pt' : 'pts'})</span>
              <span class="secret-target-slot-item">${this.escapeHtml(slot.item)}</span>
            `;
            btn.addEventListener("click", () => {
              this.closeLocalSecretTargetSlotsModal();
              this.applyLocalCorrectGuess(slot, targetPlayerId, targetPlayer.name, guesserPlayer);
              this.localPendingVerify = null;
            });
            this.localSecretSlotsList.appendChild(btn);
          }
        }

        if (this.modalLocalSecretTargetSlots) {
          this.modalLocalSecretTargetSlots.classList.remove("hidden");
          this.modalLocalSecretTargetSlots.classList.add("open");
        }
      }
    );
  }

  closeLocalSecretTargetSlotsModal() {
    if (this.modalLocalSecretTargetSlots) {
      this.modalLocalSecretTargetSlots.classList.remove("open");
      this.modalLocalSecretTargetSlots.classList.add("hidden");
    }
  }

  showLocalRevealConfirm(title, message, onConfirm) {
    if (this.localRevealConfirmTitle) {
      this.localRevealConfirmTitle.textContent = title;
    }
    if (this.localRevealConfirmMessage) {
      this.localRevealConfirmMessage.textContent = message;
    }
    this.localRevealConfirmCallback = onConfirm;
    if (this.modalLocalRevealConfirm) {
      this.modalLocalRevealConfirm.classList.remove("hidden");
      this.modalLocalRevealConfirm.classList.add("open");
    }
  }

  closeLocalRevealConfirm() {
    if (this.modalLocalRevealConfirm) {
      this.modalLocalRevealConfirm.classList.remove("open");
      this.modalLocalRevealConfirm.classList.add("hidden");
    }
    this.localRevealConfirmCallback = null;
  }

  confirmLocalReveal() {
    const cb = this.localRevealConfirmCallback;
    this.closeLocalRevealConfirm();
    if (cb) cb();
  }

  handleLocalLeave() {
    this.showConfirmModal({
      title: "END PASS & PLAY",
      message: "End this Pass & Play match and return to the Home Screen?",
      confirmText: "END MATCH",
      confirmClass: "btn-danger",
      onConfirm: () => this.executeLeaveLocalMatch()
    });
  }

  executeLeaveLocalMatch() {
    localStorage.removeItem("ta5mena_local_match");
    this.isLocalMode = false;
    this.localMatch = null;
    this.roomData = null;
    this.currentRoomCode = null;
    this.myPlayerId = null;
    this.myPlayerName = "";
    this.selectedTargetId = null;
    this.selectedTargetPlayerId = null;
    this.viewingPlayerId = null;
    this.isViewingMySecretList = false;

    this.btnHeaderHints?.classList.add("hidden");
    this.btnHeaderMyList?.classList.add("hidden");
    this.btnHeaderLeave?.classList.add("hidden");
    this.headerRoomTag?.classList.add("hidden");
    this.headerRoomStack?.classList.add("hidden");

    this.modalMyList?.classList.remove("open");
    this.modalMyList?.classList.add("hidden");
    if (this.modalHintsHub) { this.modalHintsHub.classList.remove("open"); this.modalHintsHub.classList.add("hidden"); }
    if (this.modalPrivacyCurtain) { this.modalPrivacyCurtain.classList.remove("open"); this.modalPrivacyCurtain.classList.add("hidden"); }
    if (this.modalLocalRevealConfirm) { this.modalLocalRevealConfirm.classList.remove("open"); this.modalLocalRevealConfirm.classList.add("hidden"); }
    if (this.modalLocalVerifyChoice) { this.modalLocalVerifyChoice.classList.remove("open"); this.modalLocalVerifyChoice.classList.add("hidden"); }
    if (this.modalLocalSecretTargetSlots) { this.modalLocalSecretTargetSlots.classList.remove("open"); this.modalLocalSecretTargetSlots.classList.add("hidden"); }

    this.switchView("home");
    this.checkLocalMatchSaved();
  }

  restartLocalMatchSamePlayers() {
    if (!this.localMatch || !this.localMatch.players) return;

    // Reset scores, lists, hints, milestones
    const players = this.localMatch.players;
    Object.keys(players).forEach(pid => {
      players[pid].points = 0;
      players[pid].correctGuesses = 0;
      players[pid].listSubmitted = false;
      players[pid].targetCompleted = false;
      players[pid].missedGuesses = [];
      players[pid].hints = {};
    });

    this.localMatch.meta.status = "entry";
    this.localMatch.lists = {};
    this.localMatch.finishedOrder = [];
    this.localMatch.game = {
      turnOrder: [],
      currentTurnIndex: 0,
      activePlayerId: null,
      round: 1,
      lastAction: null,
      confirmation: null
    };

    this.saveLocalMatch(this.localMatch);
    this.openLocalPlayerListEntry(0);
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
  document.querySelectorAll(".modal-backdrop").forEach(el => {
    el.classList.remove("open");
    el.classList.add("hidden");
  });
  window.gameApp = new GameController();
});
