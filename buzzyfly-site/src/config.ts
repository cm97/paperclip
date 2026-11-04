export const BRAND = "Buzzyfly Study Plan";
export const SUPPORT_EMAIL = "support@buzzyfly.com";
export const REFUND_LINE = "30-day refund if you can't access the app or it isn't as described.";

export interface Product {
	id: "student" | "classroom" | "team";
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
	team: {
		id: "team",
		name: "Business",
		price: "299.00",
		cents: 29900,
		who: "For a company or training provider preparing staff for certification exams.",
		features: [
			"Everything in Student, for up to 25 staff",
			"One team link to share by email or your intranet",
			"Plan for licences and certifications: IT, finance, nursing, trades, safety",
			"Priority support and an invoice for your records",
		],
	},
};

export const FREE_LIMITS = { exams: 1, cards: 20 };

export function productById(id: string | null | undefined): Product | null {
	return id && id in PRODUCTS ? PRODUCTS[id as Product["id"]] : null;
}
