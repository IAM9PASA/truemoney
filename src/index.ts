import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors'
import redeemvouchers from "@prakrit_m/tmn-voucher";

// แปลงข้อความตอบกลับจาก api ของ voucher
function convert_message(response: {
    code: string;
    message: string;
}): string {
    switch (response.code) {
        case "VOUCHER_NOT_FOUND":
            return "ไม่พบซอง";
        case "VOUCHER_EXPIRED":
            return "ซองหมดอายุ";
        case "VOUCHER_OUT_OF_STOCK":
            return "ซองถูกใช้ไปแล้ว";
        case "CANNOT_GET_OWN_VOUCHER":
            return "ไม่สามารถใช้ซองตัวเองได้";
        case "CONDITION_NOT_MET":
            return "ไม่ตรงเงื่อนไข";
        default:
            return `การแลกซองล้มเหลว: ${response.message}`;
    }
}

export default new Elysia()

    .use(cors({
        origin: "https://shop.sigmasobad.xyz",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    }))

    .get("/", () => "api working")

    .post("/redeem", async ({ body }) => {
        try {
            const { phone_number, voucher_url } = body as {
                phone_number?: string;
                voucher_url?: string;
            };

            if (!phone_number || !voucher_url) {
                return {
                    success: false,
                    message: "กรุณาระบุเบอร์โทรศัพท์และลิงก์คูปอง",
                };
            }

            try {
                const result = await redeemvouchers(phone_number, voucher_url);

                if (result.success) {
                    const ticket = result.data.tickets?.[0];

                    if (ticket) {
                        return {
                            success: true,
                            message: "รับเงินสำเร็จ",
                            data: {
                                name: ticket.full_name,
                                amount: ticket.amount_baht,
                            },
                        };
                    }

                    return {
                        success: false,
                        message: "ไม่พบผู้รับซอง",
                    };
                } else {
                    return {
                        success: false,
                        message: convert_message(result),
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Unknown error",
                };
            }
        } catch {
            return {
                success: false,
                message: "ข้อมูลที่ส่งมาไม่ใช่ JSON",
            };
        }
    })

    .listen(3000);