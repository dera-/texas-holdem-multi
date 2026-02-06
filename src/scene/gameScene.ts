import { Label } from "@akashic-extension/akashic-label";
import { BaseScene, basicFont } from "./baseScene";
import { GameSceneServiceParameterObject, GameSceneService, TOP_SEAT_NUMBER, TexasHoldemPhase } from "../service/gameSceneService";
import { GameStatus } from "../type/status";
import { 
	createBetUpClickHandler,
	createBetDownClickHandler,
	createBetSliderMoveHandler,
	createActionButtonClickHandler,
	createLoopHandler,
	createMessageHandler,
	createRaiseButtonClickHandler
} from "../handler/gameSceneHandler";
import { RaiseActionPattern, TexasHoldemAction } from "../model/actionModel";
import { DEFAULT_REMAINING_TIME, PlayerModel, Position, WARNIG_TIME } from "../model/playerModel";
import { OneGameResultModel } from "../model/oneGameResultModel";

export interface GameScenePrameterObject extends g.SceneParameterObject {
	service: GameSceneServiceParameterObject;
}

interface GameButtonKeyText {
	key: string;
	text: string;
}

const BUTTON_PREFIX_KEY = "button_";
const CARD_PREFIX_KEY = "card_";
const BOARD_PREFIX_KEY = "board_"
const PLAYER_ACTION_PREFIX_KEY = "player_action_";
const PLAYER_STACK_PREFIX_KEY = "player_stack_";
const PLAYER_FINISHED_PREFIX_KEY = "player_finished_";
const PLAYER_FOCUS_PREFIX_KEY = "player_focus_";
const PLAYER_RESULT_PREFIX_KEY = "player_result_";
const PLAYER_REMAINING_TIME_PREFIX_KEY = "player_remaining_time_";
const PLAYER_INFO_UNDER_LABEL_PREFIX_KEY = "player_info_under_label_";
const GAME_BLIND_KEY = "game_blind";
const GAME_TIME_KEY = "game_time";
const POT_KEY = "pot";
const THREE_BB_RAISE_KEY = "3BB_RAISE";
const HALF_POT_RAISE_KEY = "HALF_POT_RAISE";
const POT_RAISE_KEY = "POT_RAISE";
const ALLIN_RAISE_KEY = "ALLIN_RAISE";
const RAISE = "RAISE";
const CALL = "CALL";
const FOLD = "FOLD";
const BET = "BET";
const CHECK = "CHECK";
const ALLIN = "ALLIN";
const STANDARD_BUTTON_KEY_TEXTS: GameButtonKeyText[] = [
	{
		key: RAISE,
		text: RAISE
	},
	{
		key: CALL,
		text: CALL
	},
	{
		key: FOLD,
		text: FOLD
	}
];
const RAISE_BUTTON_KEY_TEXTS: GameButtonKeyText[] = [
	{
		key: THREE_BB_RAISE_KEY,
		text: "3BB"
	},
	{
		key: HALF_POT_RAISE_KEY,
		text: "1/2 POT"
	},
	{
		key: POT_RAISE_KEY,
		text: "POT"
	},
	{
		key: ALLIN_RAISE_KEY,
		text: "ALLIN"
	}
];
const convertToTexasHoldemAction = (key: string): TexasHoldemAction => {
	switch(key) {
		case RAISE:
			return "RAISE";
		case CALL:
			return "CALL";
		case FOLD:
			return "FOLD";
		default: 
			return "NONE";
	}
};
const convertToRaiseActionPattern = (key: string): RaiseActionPattern => {
	switch(key) {
		case THREE_BB_RAISE_KEY:
			return "THREE_BB";
		case HALF_POT_RAISE_KEY:
			return "HALF_POT";
		case POT_RAISE_KEY:
			return "POT";
		case ALLIN_RAISE_KEY:
			return "ALLIN";
		default: 
			return "NONE";
	}
};

export class GameScene extends BaseScene {
	private service: GameSceneService;
	private sprites: {[key: string]: g.Sprite} = {};
	private labels: {[key: string]: Label} = {};
	private rects: {[key: string]: g.FilledRect} = {};
	private pokerControllerEntity: g.E;
	private pokerTableEntity: g.E;
	private pokerPhaseEntity: g.E;
	private gameStructureEntity: g.E;
	private cardAssetConfig: g.ImageAssetConfigurationBase;
	private buttonAssetConfig: g.ImageAssetConfigurationBase;

	constructor(param: GameScenePrameterObject) {
		super(param);
	}

	protected initialize(param: GameScenePrameterObject) {
		this.service = new GameSceneService(param.service);
		this.cardAssetConfig = g.game._configuration.assets["z02"] as g.ImageAssetConfigurationBase;
		this.buttonAssetConfig = g.game._configuration.assets["button"] as g.ImageAssetConfigurationBase;
	}

	getService(): GameSceneService {
		return this.service;
	}

	getSprite(key: string): g.Sprite | null {
		return this.sprites[key] != null ? this.sprites[key] : null;
	}

	// xはグローバルな座標
	calculateBetSliderRate(x: number): number {
		const normalizedX = x - this.pokerControllerEntity.x;
		const min = this.sprites["bet_value_bar"].x;
		const max = min + this.sprites["bet_value_bar"].width - this.sprites["bet_slider"].width;
		if (normalizedX < min) {
			return 0;
		} else if (normalizedX > max) {
			return 1;
		} else {
			return Math.round(100 * (normalizedX - min) / (max - min)) / 100;
		}
	}

	getGlobalOffsetFromSprite(key: string, offset: g.CommonOffset): g.CommonOffset|null {
		if (!this.sprites[key]) {
			return null;
		}
		return this.sprites[key].localToGlobal(offset);
	}

	moveBetSlider(value: number, stack: number): void {
		const minimumValue = this.service.getMinRaiseValue();
		const rate = (value - minimumValue) / (stack - minimumValue);
		const min = this.sprites["bet_value_bar"].x;
		const max = min + this.sprites["bet_value_bar"].width - this.sprites["bet_slider"].width;
		const betSliderSprite = this.sprites["bet_slider"];
		if (rate < 0) {
			betSliderSprite.x = min;
		} else if (rate > 1) {
			betSliderSprite.x = max;
		} else {
			betSliderSprite.x = min + (max - min) * rate;
		}
		betSliderSprite.modified();
		const showsRasieButton = this.sprites[BUTTON_PREFIX_KEY + RAISE].visible();
		if (!showsRasieButton && value >= minimumValue) {
			this.sprites[BUTTON_PREFIX_KEY + RAISE].show();
		} else if (showsRasieButton && value < minimumValue && value !== stack) {
			// 最後の条件はBET=オールインの時にボタンが消えないようにするための苦し紛れの対応...
			this.sprites[BUTTON_PREFIX_KEY + RAISE].hide();
		}
	}

	initializePokerController(): void {
		this.sprites["bet_slider"].x = this.sprites["bet_value_bar"].x;
		this.sprites["bet_slider"].modified();
		this.initializeButtonLabels();
	}

	setCardsAndButton(): void {
		const initialPlayersCount = this.service.getInitialPlayersCount();
		const myself = this.service.getPlayerById(g.game.selfId);
		const startNum = myself ? myself.getSeatNumber() : TOP_SEAT_NUMBER;
		for (let i = 0; i < initialPlayersCount; i++) {
			const player = this.service.getPlayerBySeatNumber((startNum + i) % initialPlayersCount);
			if (!player) {
				continue;
			}
			const playerId = player.getId();
			const cardSpriteBaseKey = CARD_PREFIX_KEY + playerId;
			const cardAssets: g.ImageAsset[] = g.game.selfId === undefined || this.service.isAudience(g.game.selfId) || playerId === g.game.selfId ?
				this.getCardAssets(player) : [this.asset.getImageById("z02"), this.asset.getImageById("z02")];
			for (let j = 0; j < 2; j++) {
				this.sprites[cardSpriteBaseKey + "_" + j]._surface = g.SurfaceUtil.asSurface(cardAssets[j]);
				this.sprites[cardSpriteBaseKey + "_" + j].show();
				this.sprites[cardSpriteBaseKey + "_" + j].modified();
			}
			const position = player.getPosition();
			if (position === Position.DEALER || position === Position.DEALER_FOR_HEADS_UP) {
				const radian = Math.PI / 180;
				const interval = 360 / initialPlayersCount;
				this.decideDealerButtonPosition(this.sprites["poker_table"].width, this.sprites["poker_table"].height, (90 + i * interval - 15) * radian);
			}
			if (position === Position.SMALL_BLIND || position === Position.DEALER_FOR_HEADS_UP) {
				const stack = player.getStack();
				const action = player.getAction();
				const value = action != null ? action.value : this.service.getSmallBlindValue();
				this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].text = stack === 0 ? `${ALLIN}: ${value}` : `SB: ${value}`;
				this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].invalidate();
				this.labels[PLAYER_STACK_PREFIX_KEY + playerId].text = `STACK: ${stack}`;
				this.labels[PLAYER_STACK_PREFIX_KEY + playerId].invalidate();
			} else if (position === Position.BIG_BLIND) {
				const stack = player.getStack();
				const action = player.getAction();
				const value = action != null ? action.value : this.service.getBigBlindValue();
				this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].text = stack === 0 ? `${ALLIN}: ${value}` : `BB: ${value}`;
				this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].invalidate();
				this.labels[PLAYER_STACK_PREFIX_KEY + playerId].text = `STACK: ${stack}`;
				this.labels[PLAYER_STACK_PREFIX_KEY + playerId].invalidate();
			}
		}
		this.labels[POT_KEY].text = "POT: " + this.service.getPotValue();
		this.labels[POT_KEY].invalidate();
	}

	displayPhase(): void {
		this.labels["phase"].text = "Phase: " + this.service.getPhaseString();
		this.labels["phase"].invalidate();
	}

	displayStructure(): void {
		this.labels[GAME_BLIND_KEY].text = this.service.getBlindText();
		this.labels[GAME_BLIND_KEY].invalidate();
		this.labels[GAME_TIME_KEY].text = this.service.getTimeText();
		this.labels[GAME_TIME_KEY].invalidate();
	}

	drawOpenedCards(): void {
		this.service.startPhase();
		const openedCards = this.service.getOpenedCards();
		// NOTE: 描画済みのカードをまた描画してしまう無駄な処理をしてしまっている。ゲームが重かったら処理を見直してみる
		for (let i = 0; i < openedCards.length; i++) {
			const assetId = openedCards[i].getCardAssetId();
			this.sprites[BOARD_PREFIX_KEY + i]._surface = g.SurfaceUtil.asSurface(this.asset.getImageById(assetId));
			this.sprites[BOARD_PREFIX_KEY + i].show();
			this.sprites[BOARD_PREFIX_KEY + i].modified();
		}
	}

	playerAction(): void {
		const player = this.service.getCurrentPlayer();
		const playerId = player.getId();
		const action = this.service.getCurrentPlayerAction();

		// ポットとスタックへの反映
		this.service.addChipToPod(playerId);
		this.labels[POT_KEY].text = "POT: " + this.service.getPotValue();
		this.labels[POT_KEY].invalidate();
		this.labels[PLAYER_STACK_PREFIX_KEY + playerId].text = "STACK: " + player.getStack();
		this.labels[PLAYER_STACK_PREFIX_KEY + playerId].invalidate();

		// プレイヤーのアクションへの反映
		// フォールドでハンドのhidden。一旦薄黒矩形の表示はしない
		if (action.name === "FOLD") {
			const cardSpriteBaseKey = CARD_PREFIX_KEY + playerId;
			for (let j = 0; j < 2; j++) {
				this.sprites[cardSpriteBaseKey + "_" + j].hide();
				this.sprites[cardSpriteBaseKey + "_" + j].modified();
			}
		}
		let actionName: string = action.name;
		switch (actionName) {
			case RAISE:
				actionName = this.service.getCurrentCallValue() > 0 ? RAISE : BET;
				break;
			case CALL:
				actionName = this.service.isCheck() ? CHECK : (this.service.isAllin() ? ALLIN : CALL);
				break;
		}
		if (action.value > 0) {
			this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].text = action.name + " " + action.value;
		} else {
			this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].text = action.name;
		}
		this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].invalidate();
	}

	focusCurrentPlayer(isFocus: boolean): void {
		const playerId = this.service.getCurrentPlayer().getId();
		if (isFocus) {
			this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].show();
		} else {
			this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].hide();
		}
		this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].modified();
	}

	showPokerController(): void {
		const player = this.service.getCurrentPlayer();
		const playerId = player.getId();
		if (playerId === g.game.selfId) {
			this.pokerControllerEntity.show();
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].show();
		}
	}

	hidePokerController(): void {
		this.pokerControllerEntity.hide();
		const player = this.service.getCurrentPlayer();
		const playerId = player.getId();
		if (playerId === g.game.selfId) {
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].cssColor = "blue";
			// 本来であればpleyerRectのサイズを保存しておいてそれを使うべきだが、今の所用途がここしかないので手抜き
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].width = this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].width;
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].hide();
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].modified();
		}
	}

	showDown(): void {
		// ボードは多分オープンしている(もしくは別でやる)だろうから、ここではプレイヤーのオープンのみ
		this.service.getHasHandPlayers().forEach((player: PlayerModel) => {
			const playerId = player.getId();
			const cards = player.getCards();
			for (let i = 0; i < cards.length; i++) {
				const assetId = cards[i].getCardAssetId();
				this.sprites[CARD_PREFIX_KEY + playerId + "_" + i]._surface = g.SurfaceUtil.asSurface(this.asset.getImageById(assetId));
				this.sprites[CARD_PREFIX_KEY + playerId + "_" + i].modified();
			}
		});
	}

	drawWinLoss(): void {
		// NOTE: 今は結果表示とポット更新を同時に行っているが、見た目上不都合があれば修正する
		const results = this.service.getGameResults();
		this.service.updatePlayersStack(results);
		results.forEach((result: OneGameResultModel) => {
			const playerId = result.id;
			let resultText =  result.rank ? `【役：${result.rank.getRankName()}】\n`: "";
			if (result.value > 0) {
				resultText += `${result.value} 獲得`;
				// ポット獲得者を目立たせるためにフォーカス用矩形を利用
				this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].show();
			}
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].text = resultText;
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].invalidate();
			this.labels[PLAYER_STACK_PREFIX_KEY + playerId].text = "STACK: " + this.service.getPlayerById(playerId).getStack();
			this.labels[PLAYER_STACK_PREFIX_KEY + playerId].invalidate();
		});
	}

	seatOpen(): void {
		const playersCount = this.service.getPlayersCount();
		const deadPlayers = this.service.getDeadPlayers();
		for (let i = 0; i < deadPlayers.length; i++) {
			const player = deadPlayers[i];
			const playerId = player.getId();
			const cardSpriteBaseKey = CARD_PREFIX_KEY + playerId;
			for (let j = 0; j < 2; j++) {
				this.sprites[cardSpriteBaseKey + "_" + j].hide();
			}
			this.rects[PLAYER_FINISHED_PREFIX_KEY + playerId].show();
			// ここに順位を表示しておくべきか否か
			const place = playersCount - i;
			const placeStr = place > 3 ? `${place}th` : (place === 3 ? "3rd" : "2nd"); 
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].y = 0;
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].text = `Finished (${placeStr})`;
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].invalidate();
			this.rects[PLAYER_INFO_UNDER_LABEL_PREFIX_KEY + playerId].hide();
		}
		this.service.deleteDeadPlayer();
	}

	resetActions(): void {
		// アクションラベル初期化とフォーカス矩形の非表示
		const playersCount = this.service.getInitialPlayersCount();
		for (let i = 0; i < playersCount; i++) {
			const player = this.service.getPlayerBySeatNumber(i);
			if (!player) {
				continue;
			}
			const playerId = player.getId();
			this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].text = "";
			this.labels[PLAYER_ACTION_PREFIX_KEY + playerId].invalidate();
			this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].hide();
			this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].modified();
		}
		this.service.resetPlayersAction();
	}

	resetAll(): void {
		this.resetActions();
		// ボード初期化。ボードの最大枚数が5枚固定なので雑にマジックナンバーを使用
		for (let i = 0; i < 5; i++) {
			this.sprites[BOARD_PREFIX_KEY + i].hide();
			this.sprites[BOARD_PREFIX_KEY + i].modified();
		}
		this.service.resetBord();
		// ハンドは見た目だけ初期化。内部の初期化も可能だが、どうせ次ゲームのシャッフル時にやるので。
		const playersCount = this.service.getInitialPlayersCount();
		for (let i = 0; i < playersCount; i++) {
			const player = this.service.getPlayerBySeatNumber(i);
			if (!player) {
				continue;
			}
			const playerId = player.getId();
			const cardSpriteBaseKey = CARD_PREFIX_KEY + playerId;
			for (let j = 0; j < 2; j++) {
				this.sprites[cardSpriteBaseKey + "_" + j].hide();
				this.sprites[cardSpriteBaseKey + "_" + j].modified();
			}
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].text = ""
			this.labels[PLAYER_RESULT_PREFIX_KEY + playerId].invalidate();
		}
	}

	changeBetLabel(value: number): void {
		this.labels[BUTTON_PREFIX_KEY + RAISE].text = `${this.service.isAllin(value) ? ALLIN : (this.service.getCurrentCallValue() > 0 ? RAISE : BET)}: ${value}`;
		this.labels[BUTTON_PREFIX_KEY + RAISE].invalidate();
	}

	waitPlayerThinking(): void {
		const player = this.service.getCurrentPlayer();
		const playerId = player.getId();
		const remainingTime = player.getRemainingTime();
		this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].width = 
			(remainingTime / DEFAULT_REMAINING_TIME) * this.rects[PLAYER_FOCUS_PREFIX_KEY + playerId].width;
		if (remainingTime < WARNIG_TIME) {
			this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].cssColor = "red";
		}
		this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + playerId].modified();
	}

	private initializeButtonLabels(): void {
		const showsRasieButton = this.sprites[BUTTON_PREFIX_KEY + RAISE].visible();
		const isAliinToCall = this.service.isAllin();
		if (!showsRasieButton && !isAliinToCall) {
			this.sprites[BUTTON_PREFIX_KEY + RAISE].show();
		} else if (showsRasieButton && isAliinToCall) {
			this.sprites[BUTTON_PREFIX_KEY + RAISE].hide();
		}
		const minRaiseValue = this.service.getMinRaiseValue();
		const totalStack = this.service.getCurrentPlayer().getTotalStack();
		const currentCallValue = this.service.getCurrentCallValue();
		if (totalStack <= minRaiseValue) {
			this.labels[BUTTON_PREFIX_KEY + RAISE].text = `${ALLIN}: ${totalStack}`;
		} else {
			this.labels[BUTTON_PREFIX_KEY + RAISE].text = `${currentCallValue > 0 ? RAISE : BET}: ${minRaiseValue}`;
		}
		this.labels[BUTTON_PREFIX_KEY + RAISE].invalidate();
		this.labels[BUTTON_PREFIX_KEY + CALL].text = this.service.isCheck() ? CHECK :
			isAliinToCall ? `${ALLIN}: ${totalStack}` :
			`${CALL}: ${currentCallValue}`;
		this.labels[BUTTON_PREFIX_KEY + CALL].invalidate();
		const threeBbValue = 3 * this.service.getBigBlindValue();
		if (this.service.getActionPhase() === TexasHoldemPhase.PRE_FLOP && threeBbValue >= minRaiseValue) {
			this.sprites[BUTTON_PREFIX_KEY + THREE_BB_RAISE_KEY].show();
		} else {
			this.sprites[BUTTON_PREFIX_KEY + THREE_BB_RAISE_KEY].hide();			
		}
		const potValue = this.service.getPotValue();
		if (potValue >= minRaiseValue) {
			this.sprites[BUTTON_PREFIX_KEY + POT_RAISE_KEY].show();
		} else {
			this.sprites[BUTTON_PREFIX_KEY + POT_RAISE_KEY].hide();
		}
		if (potValue / 2 >= minRaiseValue) {
			this.sprites[BUTTON_PREFIX_KEY + HALF_POT_RAISE_KEY].show();
		} else {
			this.sprites[BUTTON_PREFIX_KEY + HALF_POT_RAISE_KEY].hide();
		}
	}

	protected handlerToLoad(): void {
		const backRect = new g.FilledRect({
			scene: this,
			cssColor: "#0b2a1f",
			width: g.game.width,
			height: g.game.height
		});
		this.append(backRect);
		const topShade = new g.FilledRect({
			scene: this,
			cssColor: "#071a13",
			width: g.game.width,
			height: 0.08 * g.game.height,
			opacity: 0.6
		});
		this.append(topShade);
		const bottomShade = new g.FilledRect({
			scene: this,
			cssColor: "#071a13",
			width: g.game.width,
			height: 0.14 * g.game.height,
			y: 0.86 * g.game.height,
			opacity: 0.65
		});
		this.append(bottomShade);
		this.pokerTableEntity = this.createPokerTableEntity({ x: 0, y: 0.1 * g.game.height, width: g.game.width, height: 0.7 * g.game.height });
		this.append(this.pokerTableEntity);
		this.pokerPhaseEntity = this.createPhaseEntity({ x: 0.7 * g.game.width, y: 0, width: 0.3 * g.game.width, height: 0.1 * g.game.height });
		this.append(this.pokerPhaseEntity);
		this.gameStructureEntity = this.createStructureEntity({ x: 0.05 * g.game.width, y: 0, width: 0.55 * g.game.width, height: 0.1 * g.game.height })
		this.append(this.gameStructureEntity);
		this.pokerControllerEntity = this.createPokerControllerEntity({ x: 0.05 * g.game.width, y: 0.8 * g.game.height, width: 0.9 * g.game.width, height: 0.1 * g.game.height });
		this.pokerControllerEntity.hide();
		this.append(this.pokerControllerEntity);
		this.onUpdate.add(createLoopHandler(this));
		this.onMessage.add(createMessageHandler(this));

		// ゲーム開始
		this.pushStatuses(["GAME_START"]);
	}

	private createPokerControllerEntity(area: g.CommonArea): g.E {
		const { width, height, x, y } = area;
		const controllerEntity = new g.E({ scene: this, width, height, x, y, local: true });
		// ベットスライダーセットの長さ = コントローラーエンティティの長さにする
		this.sprites["bet_value_bar"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("bet_value_bar"),
			srcWidth: 672,
			srcHeight: 25,
			width: 0.45 * width,
			x: 0.05 * width,
			y: 0.7 * height,
			touchable: true,
			local: true
		});
		controllerEntity.append(this.sprites["bet_value_bar"]);
		this.sprites["bet_up"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("bet_up"),
			srcWidth: 51,
			srcHeight: 62,
			width: 0.05 * width,
			x: 0.5 * width,
			y: 0.5 * height,
			touchable: true,
			local: true
		});
		this.sprites["bet_up"].onPointDown.add(createBetUpClickHandler(this));
		this.attachButtonFeedback(this.sprites["bet_up"], { pressedScale: 0.92, pressedOpacity: 0.85 });
		controllerEntity.append(this.sprites["bet_up"]);
		this.sprites["bet_down"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("bet_down"),
			srcWidth: 57,
			srcHeight: 62,
			width: 0.05 * width,
			x: 0,
			y: 0.5 * height,
			touchable: true,
			local: true
		});
		this.sprites["bet_down"].onPointDown.add(createBetDownClickHandler(this));
		this.attachButtonFeedback(this.sprites["bet_down"], { pressedScale: 0.92, pressedOpacity: 0.85 });
		controllerEntity.append(this.sprites["bet_down"]);
		const betSliderConfig = g.game._configuration.assets["bet_slider"] as g.ImageAssetConfigurationBase;
		this.sprites["bet_slider"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("bet_slider"),
			srcWidth: betSliderConfig.width,
			srcHeight: betSliderConfig.height,
			width: 0.75 * betSliderConfig.width,
			height: 0.75 * betSliderConfig.height,
			x: this.sprites["bet_value_bar"].x,
			y: this.sprites["bet_value_bar"].y - 0.75 * betSliderConfig.height,
			touchable: true,
			local: true
		});
		this.sprites["bet_slider"].onPointMove.add(createBetSliderMoveHandler(this));
		controllerEntity.append(this.sprites["bet_slider"]);
		// アクション用ボタン設置
		for (let i = 0; i < STANDARD_BUTTON_KEY_TEXTS.length; i++) {
			const data = STANDARD_BUTTON_KEY_TEXTS[i];
			const key = data.key;
			this.sprites[BUTTON_PREFIX_KEY + key] = new g.Sprite({
				scene: this,
				src: this.asset.getImageById("button"),
				touchable: true,
				local: true,
				width: 0.12 * width,
				height: (0.12 * width / this.buttonAssetConfig.width) * this.buttonAssetConfig.height,
				x: (0.5725 + 0.1425 * i) * width,
				y: 0.55 * height
			});
			const label = new Label({
				scene: this,
				text: data.text,
				font: basicFont,
				fontSize: 0.018 * width, // あくまで目安。あとで変えるかも
				textColor: "white",
				textAlign: "center",
				width: 0.12 * width,
				local: true
			});
			this.labels[BUTTON_PREFIX_KEY + key] = label;
			this.sprites[BUTTON_PREFIX_KEY + key].append(label);
			this.attachButtonFeedback(this.sprites[BUTTON_PREFIX_KEY + key], {
				onPress: () => {
					label.textColor = "#f5d76e";
					label.invalidate();
				},
				onRelease: () => {
					label.textColor = "white";
					label.invalidate();
				}
			});
			this.sprites[BUTTON_PREFIX_KEY + key].onPointUp.add(createActionButtonClickHandler(
				this,
				convertToTexasHoldemAction(key)
			));
			controllerEntity.append(this.sprites[BUTTON_PREFIX_KEY + key]);
		}
		// RAISE補助用ボタン設置
		for (let i = 0; i < RAISE_BUTTON_KEY_TEXTS.length; i++) {
			const data = RAISE_BUTTON_KEY_TEXTS[i];
			const key = data.key;
			this.sprites[BUTTON_PREFIX_KEY + key] = new g.Sprite({
				scene: this,
				src: this.asset.getImageById("button"),
				touchable: true,
				local: true,
				width: 0.08 * width,
				height: 0.75 * (0.08 * width / this.buttonAssetConfig.width) * this.buttonAssetConfig.height,
				x: (0.5725 + 0.1 * i) * width,
				y: 0.1 * height
			});
			const label = new Label({
				scene: this,
				text: data.text,
				font: basicFont,
				fontSize: 0.012 * width, // あくまで目安。あとで変えるかも
				textColor: "white",
				textAlign: "center",
				width: 0.08 * width,
				local: true
			});
			this.labels[BUTTON_PREFIX_KEY + key] = label;
			this.sprites[BUTTON_PREFIX_KEY + key].append(label);
			this.attachButtonFeedback(this.sprites[BUTTON_PREFIX_KEY + key], {
				onPress: () => {
					label.textColor = "#f5d76e";
					label.invalidate();
				},
				onRelease: () => {
					label.textColor = "white";
					label.invalidate();
				}
			});
			this.sprites[BUTTON_PREFIX_KEY + key].onPointUp.add(createRaiseButtonClickHandler(
				this,
				convertToRaiseActionPattern(key)
			));
			controllerEntity.append(this.sprites[BUTTON_PREFIX_KEY + key]);
		}
		return controllerEntity;
	}

	private createPokerTableEntity(area: g.CommonArea): g.E {
		const { width, height, x, y } = area;
		const entity = new g.E({ scene: this, width, height, x, y, local: true });
		const myself = this.service.getPlayerById(g.game.selfId);
		// ほぼ背景としてのポーカーマット画像
		this.sprites["poker_table"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("poker_table"),
			srcWidth: 1650,
			srcHeight: 901,
			width: width,
			height: height
		});
		entity.append(this.sprites["poker_table"]);
		// ディーラーボタン登録
		this.sprites["dealer"] = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("dealer"),
			srcWidth: 100,
			srcHeight: 100,
			width: 75,
			height: 75,
			local: true
		});
		entity.append(this.sprites["dealer"]);
		// 各プレイヤーの情報とハンド画像(あと、ボタン画像も)
		const startNum = myself ? myself.getSeatNumber() : TOP_SEAT_NUMBER;
		const playersCount = this.service.getInitialPlayersCount();
		const radian = Math.PI/180;
		const interval = 360 / playersCount;
		for (let i = 0; i < playersCount; i++) {
			let currentNum = (startNum + i) % playersCount;
			const player = this.service.getPlayerBySeatNumber(currentNum);
			const angle = (90 + i * interval) * radian;
			entity.append(this.createPlayerEntity(
				{
					x: 0.75 * (width / 2) * Math.cos(angle) + width / 2 - 0.5 * this.cardAssetConfig.width,
					y: 0.75 * (height / 2) * Math.sin(angle) + height / 2 - 0.025 * width,
					width: this.cardAssetConfig.width,
					height: 0.5 * this.cardAssetConfig.height
				},
				player
			));
		}
		// ボード画像とポット情報
		for (let i = 0; i < 5 ; i++) {
			this.sprites[BOARD_PREFIX_KEY + i] = new g.Sprite({
				scene: this,
				src: this.asset.getImageById("z02"),
				hidden: true,
				width: (0.25 * height / this.cardAssetConfig.height) * this.cardAssetConfig.width,
				height: 0.25 * height,
				srcWidth: 150,
				srcHeight: 225,
				x: (0.25 + 0.1 * i) * width,
				y: 0.3 * height
			});
			entity.append(this.sprites[BOARD_PREFIX_KEY + i]);
		}
		const potLabel = new Label({
			scene: this,
			text: "POT: " + this.service.getPotValue(),
			font: basicFont,
			fontSize: 0.03 * width, // あくまで目安。あとで変えるかも
			textColor: "black",
			textAlign: "center",
			width: 0.2 * width,
			x: 0.4 * width,
			y: 0.55 * height
		});
		this.labels[POT_KEY] = potLabel;
		entity.append(potLabel);
		return entity;
	}

	private createPlayerEntity(area: g.CommonArea, player: PlayerModel): g.E {
		const { width, height, x, y } = area;
		const entity = new g.E({ scene: this, width, height, x, y, local: true });
		for (let i = 0; i < 2; i++) {
			// トランプ裏側画像でカードspriteを作っておく
			const cardSprite = new g.Sprite({
				scene: this,
				src: this.asset.getImageById("z02"),
				srcWidth: this.cardAssetConfig.width,
				srcHeight: this.cardAssetConfig.height,
				width: 0.5 * width,
				height: height,
				x: 0.5 * i * width,
				touchable: true,
				local: true
			});
			const key = CARD_PREFIX_KEY + player.getId() + "_" + i;
			this.sprites[key] = cardSprite;
			entity.append(this.sprites[key]);
		}
		const focusRect = new g.FilledRect({
			scene: this,
			cssColor: "blue",
			width,
			height,
			opacity: 0.5,
			local: true,
			hidden: true
		});
		this.rects[PLAYER_FOCUS_PREFIX_KEY + player.getId()] = focusRect;
		entity.append(focusRect);
		const playerInfoRect = new g.FilledRect({
			scene: this,
			cssColor: "black",
			width,
			height: 0.6 * height,
			y: 0.4 * height,
			opacity: 0.7,
			local: true
		});
		const playerNameLabel = new Label({
			scene: this,
			text: player.getName(),
			font: basicFont,
			fontSize: 0.13 * width, // あくまで目安。あとで変えるかも
			textColor: "white",
			textAlign: "center",
			width: width,
			x: 0.03 * width,
			y: 0.1 * playerInfoRect.height,
			local: true
		});
		playerInfoRect.append(playerNameLabel);
		const playerStackLabel = new Label({
			scene: this,
			text: "STACK: " + player.getStack(),
			font: basicFont,
			fontSize: 0.12 * width, // あくまで目安。あとで変えるかも
			textColor: "white",
			textAlign: "left",
			width: width,
			x: 0.03 * width,
			y: 0.6 * playerInfoRect.height,
			local: true
		});
		this.labels[PLAYER_STACK_PREFIX_KEY + player.getId()] = playerStackLabel;
		playerInfoRect.append(playerStackLabel);
		entity.append(playerInfoRect);
		// アクションや結果ラベルの下に敷く矩形
		const rectUnderLabel = new g.FilledRect({
			scene: this,
			cssColor: "black",
			width: 1.5 * width,
			height: 0.37 * height,
			x: -0.25 * width,
			y: -0.37 * height,
			opacity: 0.7,
			local: true
		});
		this.rects[PLAYER_INFO_UNDER_LABEL_PREFIX_KEY + player.getId()] = rectUnderLabel;
		entity.append(rectUnderLabel);
		const actionLabel = new Label({
			scene: this,
			text: "",
			font: basicFont,
			fontSize: 0.15 * width, // あくまで目安。あとで変えるかも
			textColor: "white",
			textAlign: "center",
			width: width,
			x: 0,
			y: -0.3 * height,
			local: true
		});
		this.labels[PLAYER_ACTION_PREFIX_KEY + player.getId()] = actionLabel;
		entity.append(actionLabel);
		const resultLabel = new Label({
			scene: this,
			text: "",
			font: basicFont,
			fontSize: 0.125 * width, // あくまで目安。あとで変えるかも
			textColor: "white",
			textAlign: "center",
			width: 1.5 * width,
			x: -0.25 * width,
			y: -0.37 * height,
			local: true
		});
		this.labels[PLAYER_RESULT_PREFIX_KEY + player.getId()] = resultLabel;
		entity.append(resultLabel);
		const finishedRect = new g.FilledRect({
			scene: this,
			cssColor: "black",
			width,
			height,
			opacity: 0.5,
			local: true,
			hidden: true
		});
		this.rects[PLAYER_FINISHED_PREFIX_KEY + player.getId()] = finishedRect;
		entity.append(finishedRect);
		const remainingTimeRect = new g.FilledRect({
			scene: this,
			cssColor: "blue",
			width,
			height: 0.1 * height,
			y: height,
			local: true,
			hidden: true
		});
		this.rects[PLAYER_REMAINING_TIME_PREFIX_KEY + player.getId()] = remainingTimeRect;
		entity.append(remainingTimeRect);
		return entity;
	}

	// 現在のPhaseを表示するエンティティを作成
	private createPhaseEntity(area: g.CommonArea): g.E {
		const { width, height, x, y } = area;
		const entity = new g.E({ scene: this, width, height, x, y });
		const phaseLabel = new Label({
			scene: this,
			text: "",
			font: basicFont,
			fontSize: 36, // あくまで目安。あとで変えるかも
			textColor: "black",
			textAlign: "left",
			width: width
		});
		this.labels["phase"] = phaseLabel;
		entity.append(phaseLabel);
		return entity;
	}

	private createStructureEntity(area: g.CommonArea): g.E {
		const { width, height, x, y } = area;
		const entity = new g.E({ scene: this, width, height, x, y });
		const blindLabel = new Label({
			scene: this,
			text: "SB/BB: ",
			font: basicFont,
			fontSize: 36,
			textColor: "black",
			textAlign: "left",
			width: 0.5 * width
		});
		this.labels[GAME_BLIND_KEY] = blindLabel;
		entity.append(blindLabel);
		const timeLabel = new Label({
			scene: this,
			text: "TIME: ",
			font: basicFont,
			fontSize: 36,
			textColor: "black",
			textAlign: "left",
			x: 0.5 * width,
			width: 0.5 * width
		});
		this.labels[GAME_TIME_KEY] = timeLabel;
		entity.append(timeLabel);
		return entity;
	}

	private decideDealerButtonPosition(width: number, height: number, angle: number): void {
		this.sprites["dealer"].x = 0.65 * (width / 2) * Math.cos(angle) + width / 2 - 0.5 * this.cardAssetConfig.width;
		this.sprites["dealer"].y = 0.6 * (height / 2) * Math.sin(angle) + height / 2 - 0.05 * width;
		this.sprites["dealer"].modified();
	}

	private getCardAssets(player: PlayerModel): g.ImageAsset[] {
		const cards: g.ImageAsset[] = player.getCards().map(c => this.asset.getImageById(c.getCardAssetId()));
		const cardsCount = cards.length;
		// カードが2枚に満たない場合は、裏面で補う
		for (let i = 0; i < 2 - cardsCount; i++) {
			cards.push(this.asset.getImageById("z02"));
		}
		return cards;
	}

	changeStatusByAutomaticTiming(nextStatus?: GameStatus, time: number = 500): void {
		if (!nextStatus) {
			this.pushStatuses(["WAITING"]);
		} else {
			this.pushStatuses([nextStatus, "WAITING"]);
		}
		this.setTimeout(() => {
			if (this.getCurrentStatus() === "WAITING") {
				this.popStatus();
			}
		}, time);
	}
}
