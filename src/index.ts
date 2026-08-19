import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { TmnVoucherClient } from "@prakrit_m/tmn-voucher";

const voucherClient = new TmnVoucherClient();

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
        case "TARGET_USER_NOT_FOUND":
            return "ไม่พบบัญชีผู้รับ";
        case "TARGET_USER_REDEEMED":
            return "บัญชีนี้เคยรับซองนี้แล้ว";
        case "TARGET_USER_STATUS_INACTIVE":
            return "บัญชีผู้รับไม่พร้อมใช้งาน";
        case "INVALID_INPUT":
            return "ข้อมูลไม่ถูกต้อง";
        case "MAINTENANCE":
            return "ระบบซองกำลังปิดปรับปรุง";
        case "TIMEOUT":
            return "การเชื่อมต่อหมดเวลา";
        case "NETWORK_ERROR":
            return "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ";
        default:
            return `การแลกซองล้มเหลว: ${response.message}`;
    }
}

const app = new Elysia()
    .use(
        cors({
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        }),
    )

    .get("/", () => "voucher api working")

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
                const result = await voucherClient.redeemVoucher(
                    phone_number,
                    voucher_url,
                );

                if (result.success) {
                    const ticket =
                        result.data.raw.my_ticket ?? result.data.raw.tickets?.[0];

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
                }

                return {
                    success: false,
                    message: convert_message(result),
                };
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

    .listen({
        hostname: "0.0.0.0",
        port: Number(process.env.PORT ?? 3000),
    });

console.log(`Running on http://localhost:${app.server?.port}`);

export default app;