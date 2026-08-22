import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Impit, type HttpMethod, type RequestInit as ImpitRequestInit } from "impit";
import { TmnVoucherClient } from "@prakrit_m/tmn-voucher";

const impit = new Impit({
    browser: "firefox",
    timeout: 15_000,
});

const CODE_TH: Record<string, string> = {
    VOUCHER_NOT_FOUND: "ไม่พบซอง",
    VOUCHER_EXPIRED: "ซองหมดอายุ",
    VOUCHER_OUT_OF_STOCK: "ซองถูกใช้ไปแล้ว",
    CANNOT_GET_OWN_VOUCHER: "ไม่สามารถใช้ซองตัวเองได้",
    CONDITION_NOT_MET: "ไม่ตรงเงื่อนไข",
    TARGET_USER_NOT_FOUND: "ไม่พบบัญชีผู้รับ",
    TARGET_USER_REDEEMED: "บัญชีนี้เคยรับซองนี้แล้ว",
    TARGET_USER_STATUS_INACTIVE: "บัญชีผู้รับไม่พร้อมใช้งาน",
    INVALID_INPUT: "ข้อมูลไม่ถูกต้อง",
    BAD_PARAM: "ข้อมูลไม่ถูกต้อง",
    MAINTENANCE: "ระบบซองกำลังปิดปรับปรุง",
    TIMEOUT: "การเชื่อมต่อหมดเวลา",
    NETWORK_ERROR: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ",
};

function request_url(input: string | URL | Request): string {
    if (typeof input === "string") {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    return input.url;
}

function to_http_method(method: string | undefined): HttpMethod | undefined {
    if (!method) {
        return undefined;
    }
    const upper = method.toUpperCase();
    const allowed: HttpMethod[] = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "HEAD",
        "OPTIONS",
        "TRACE",
    ];
    return allowed.find((m) => m === upper);
}

function to_impit_init(init?: RequestInit): ImpitRequestInit | undefined {
    if (!init) {
        return undefined;
    }
    const headers: Record<string, string> = {};
    if (init.headers) {
        new Headers(init.headers).forEach((value, key) => {
            headers[key] = value;
        });
    }
    const body = init.body;
    return {
        method: to_http_method(init.method),
        headers,
        body: typeof body === "string" ? body : undefined,
    };
}

function tmn_status_code(value: unknown): string | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.code === "string" && obj.code in CODE_TH) {
        return obj.code;
    }
    const status = obj.status;
    if (status && typeof status === "object") {
        const code = (status as Record<string, unknown>).code;
        if (typeof code === "string" && code in CODE_TH) {
            return code;
        }
    }
    if ("data" in obj) {
        return tmn_status_code(obj.data);
    }
    return null;
}

function wrap_tmn_error_body(json: Record<string, unknown>): string | null {
    const nested = json.status;
    if (nested && typeof nested === "object") {
        const status = nested as Record<string, unknown>;
        if (typeof status.code === "string" && typeof status.message === "string") {
            return JSON.stringify(json);
        }
    }

    const code = typeof json.code === "string" ? json.code : tmn_status_code(json);
    if (!code) {
        return null;
    }

    return JSON.stringify({
        status: {
            code,
            message: typeof json.message === "string" ? json.message : code,
        },
        data: json.data ?? null,
    });
}

function is_cloudflare_block(status: number, body: string): boolean {
    if (status !== 403 && status !== 503) {
        return false;
    }
    return (
        body.includes("Attention Required") ||
        body.includes("Cloudflare") ||
        body.includes("cf-browser-verification")
    );
}

async function tmn_fetch(
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> {
    const url = request_url(input);
    const res = await impit.fetch(url, to_impit_init(init));
    const text = await res.text();

    if (res.ok) {
        return new Response(text, {
            status: res.status,
            statusText: res.statusText,
            headers: { "Content-Type": "application/json" },
        });
    }

    console.warn(`[tmn] HTTP ${res.status} ${url} ${text.slice(0, 400)}`);

    if (is_cloudflare_block(res.status, text)) {
        return new Response(text, {
            status: res.status,
            statusText: res.statusText,
        });
    }

    try {
        const json = JSON.parse(text);
        if (json && typeof json === "object") {
            const wrapped = wrap_tmn_error_body(json as Record<string, unknown>);
            if (wrapped) {
                return new Response(wrapped, {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
        }
    } catch {
        // keep original status
    }

    return new Response(text, {
        status: res.status,
        statusText: res.statusText,
    });
}

const voucherClient = new TmnVoucherClient({
    timeoutMs: 15_000,
    fetch: tmn_fetch,
});

function convert_message(response: {
    code: string;
    message: string;
    data?: unknown;
}): string {
    const code = tmn_status_code(response) ?? response.code;
    if (CODE_TH[code]) {
        return CODE_TH[code];
    }

    const blob = `${response.message} ${JSON.stringify(response.data ?? "")}`.toLowerCase();
    if (blob.includes("expired") || blob.includes("หมดอายุ")) {
        return "ซองหมดอายุ";
    }
    if (blob.includes("not found") || blob.includes("ไม่พบซอง")) {
        return "ไม่พบซอง";
    }
    if (
        blob.includes("out of stock") ||
        blob.includes("already used") ||
        blob.includes("ถูกใช้")
    ) {
        return "ซองถูกใช้ไปแล้ว";
    }
    if (blob.includes("own voucher") || blob.includes("ตัวเอง")) {
        return "ไม่สามารถใช้ซองตัวเองได้";
    }
    if (blob.includes("redeemed")) {
        return "บัญชีนี้เคยรับซองนี้แล้ว";
    }
    if (blob.includes("inactive")) {
        return "บัญชีผู้รับไม่พร้อมใช้งาน";
    }
    if (blob.includes("maintenance")) {
        return "ระบบซองกำลังปิดปรับปรุง";
    }
    if (
        blob.includes("403") ||
        blob.includes("forbidden") ||
        blob.includes("cloudflare")
    ) {
        return "เชื่อมต่อ TrueMoney ไม่สำเร็จ";
    }

    return "ใช้ซองไม่สำเร็จ";
}

const app = new Elysia()
    .use(
        cors({
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        }),
    )
    .onError(({ code }) => {
        if (code === "PARSE") {
            return {
                success: false,
                message: "ข้อมูลที่ส่งมาไม่ใช่ JSON",
            };
        }
    })

    .get("/", () => "voucher api working")

    .post("/redeem", async ({ body }) => {
        const { phone_number, voucher_url } = (body ?? {}) as {
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

            const message = convert_message(result);
            console.warn(`[redeem] ${result.code} ${result.message} -> ${message}`);
            return {
                success: false,
                message,
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error
                    ? error.message
                    : "Unknown error",
            };
        }
    });

if (!process.env.VERCEL) {
    app.listen({
        hostname: "0.0.0.0",
        port: Number(process.env.PORT ?? 3000),
    });

    console.log(`Running on http://localhost:${app.server?.port}`);
}

export default app;
