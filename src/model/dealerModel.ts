import { CardModel } from "./cardModel";

export class DealerModel {
	cards: CardModel[];
	index: number;
	private random: g.RandomGenerator;

	constructor(cards: CardModel[], random?: g.RandomGenerator) {
		this.cards = cards;
		this.index = 0;
		this.random = random || g.game.random;
		this.shuffleCards();
	}

	shuffleCards(): void {
		this.index = 0;
		let shuffledCards = [],
			cloneCards = [].concat(this.cards);
		while (cloneCards.length > 0) {
			let index = Math.floor(this.random.generate() * cloneCards.length);
			shuffledCards.push(cloneCards[index]);
			cloneCards.splice(index, 1);
		}
		this.cards = shuffledCards;
	}

	getNextCard(): CardModel {
		this.index++;
		return this.cards[this.index-1];
	}
}
