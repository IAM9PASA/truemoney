import { Elysia } from "elysia";
import redeemvouchers from "@prakrit_m/tmn-voucher";

// แปลงข้อความตอบกลับจาก api ของ voucher
function convert_message(response: {
    code: string;
    message: string
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
            return `การแลกซองล้มเหลว: ${response.message
                }`;
    }
}

const app = new Elysia()
    .get("/", () => "api working")
    .post("/redeem", async ({ body, set }) => {
        try {
            const { phone_number, voucher_url } = body as {
                phone_number?: string;
                voucher_url?: string;
            };

            if (!phone_number || !voucher_url) {
                set.status = 400;
                return { success: false, status: 400, message: "กรุณาระบุเบอร์โทรศัพท์และลิงก์คูปอง" };
            }

            try {
                const result = await redeemvouchers(phone_number, voucher_url);

                if (result.success) {
                    const ticket = result.data.tickets?.[0];

                    if (ticket) {
                        return {
                            success: true,
                            status: 200,
                            message: "รับเงินสำเร็จ",
                            data: {
                                name: ticket.full_name,
                                amount: ticket.amount_baht
                            }
                        };
                    }

                    set.status = 400;
                    return { success: false, status: 400, message: "ไม่พบผู้รับซอง" };
                } else {
                    const message = convert_message(result);
                    set.status = 400;
                    return {
                        success: false,
                        status: 400,
                        message: message || "ไม่สามารถรับซองได้"
                    };
                }
            } catch (error) {
                set.status = 500;
                return {
                    success: false,
                    status: 500,
                    message: error instanceof Error ? error.message : "Unknown error"
                };
            }
        } catch {
            set.status = 400;
            return { success: false, status: 400, message: "ข้อมูลที่ส่งมาไม่ใช่ JSON" };
        }
    }
    )
    .listen(3000);

console.log("truemoney api running at http://localhost:3000")
