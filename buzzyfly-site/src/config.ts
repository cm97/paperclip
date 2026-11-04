export const BRAND = "Buzzyfly Study Plan";
export const SUPPORT_EMAIL = "support@buzzyfly.com";
export const REFUND_LINE = "30-day refund if you can't access the app or it isn't as described.";

export interface Product {
	id: "student" | "classroom";
	name: string;
	price: string; // USD, PayPal format
	cents: number;
	who: string;
	features: string[];
}

export const PRODUCTS: Record<Product["id"], Product> = {
	student: {
		id: "student",
		name: "Student",
		price: "19.00",
		cents: 1900,
		who: "For one student, any subject, any exam.",
		features: [
			"Unlimited exams and subjects",
			"A day-by-day plan with spaced review built in",
			"Unlimited flashcards that drill your weak spots first",
			"Printable plan for the fridge or binder",
		],
	},
	classroom: {
		id: "classroom",
		name: "Classroom",
		price: "99.00",
		cents: 9900,
		who: "For one teacher. Share one link with your class.",
		features: [
			"Everything in Student",
			"One class link: students open it and start planning",
			"No student accounts, no emails collected",
			"Pay once with a school card or a PayPal invoice",
		],
	},
};

export const FREE_LIMITS = { exams: 1, cards: 20 };

export function productById(id: string | null | undefined): Product | null {
	return id && id in PRODUCTS ? PRODUCTS[id as Product["id"]] : null;
}
