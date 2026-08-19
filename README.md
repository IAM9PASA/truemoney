# TrueMoney Voucher API

HTTP API for redeeming TrueMoney Wallet gift vouchers (อั่งเปา) into a phone number.

Built with [Elysia](https://elysiajs.com) and [Bun](https://bun.sh). Voucher redemption uses [`@prakrit_m/tmn-voucher`](https://www.npmjs.com/package/@prakrit_m/tmn-voucher).

This project is **not** affiliated with TrueMoney.

## Requirements

- [Bun](https://bun.sh) 1.x

## Setup

```bash
bun install
```

## Run

Development (watches `src/index.ts`):

```bash
bun run dev
```

Production:

```bash
bun run build
bun run start
```

The server listens on [http://localhost:3000](http://localhost:3000).

## Docker

Requires Docker Compose.

```bash
docker compose up --build
```

The API is then at [http://localhost:3000](http://localhost:3000).

## Endpoints

### `GET /`

Health check. Returns `api working`.

### `POST /redeem`

Redeems a voucher into the given TrueMoney Wallet phone number.

**Request**

```json
{
  "phone_number": "0812345678",
  "voucher_url": "https://gift.truemoney.com/campaign/?v=YOUR_VOUCHER_CODE"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `phone_number` | string | yes | 10-digit Thai mobile number starting with `0` |
| `voucher_url` | string | yes | Full gift link or voucher code |

**Success**

```json
{
  "success": true,
  "message": "รับเงินสำเร็จ",
  "data": {
    "name": "John Doe",
    "amount": "50.00"
  }
}
```

**Failure**

```json
{
  "success": false,
  "message": "ไม่พบซอง"
}
```

Common failure messages:

| Message | Meaning |
| --- | --- |
| กรุณาระบุเบอร์โทรศัพท์และลิงก์คูปอง | Missing `phone_number` or `voucher_url` |
| ไม่พบซอง | Voucher not found |
| ซองหมดอายุ | Voucher expired |
| ซองถูกใช้ไปแล้ว | Voucher already redeemed |
| ไม่สามารถใช้ซองตัวเองได้ | Cannot redeem your own voucher |
| ไม่ตรงเงื่อนไข | Voucher conditions were not met |
| ไม่พบบัญชีผู้รับ | Destination wallet was not found |
| บัญชีนี้เคยรับซองนี้แล้ว | This number already redeemed the voucher |
| ระบบซองกำลังปิดปรับปรุง | TrueMoney voucher service is in maintenance |

## CORS

Requests from any origin are allowed. The previous shop-specific origin restriction has been removed.

## Project layout

```
src/index.ts           API routes and voucher redeem handler
Dockerfile             Production image
docker-compose.yml     One-command local/container run
```
