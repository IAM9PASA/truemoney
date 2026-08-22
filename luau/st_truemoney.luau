-- SERVICES -------------------------

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

-- MODULES -------------------------

local main = require(ServerScriptService.configs.main)
local Easy = require(ReplicatedStorage.Modules.NextGen.Easy)
local validate = require(ReplicatedStorage.Modules.NextGen.validate)
local points_service = require(ServerScriptService.server_services.points_service)
local webhook = require(ServerScriptService.modules.webhook)

-- CONFIG -------------------------

-- D:\_coding\Language\Typescript\__PRODUCTION\truemoney  POST /redeem
local API_URL = "http://185.84.160.127:3000/redeem"

-- FUNCTIONS -------------------------

-- validate truemoney gift url
local function url_check(url: string)
	if validate:string(url) and #url <= 256 then
		return url:match("^https://gift%.truemoney%.com/campaign/%?v=[A-Za-z0-9]+$") ~= nil
	end
	return false
end

-- MAIN -------------------------

type redeem_response = {
	success: boolean,
	message: string,
	data: {
		name: string,
		amount: string,
	}?,
}

-- post gift link to own redeem api
local function redeem_voucher(phone: string, gift_link: string): (boolean?, redeem_response?)
	assert(phone, "phone not found")
	assert(gift_link, "gift_link not found")

	local body = HttpService:JSONEncode({
		phone_number = phone,
		voucher_url = gift_link,
	})

	local ok, http_res = Easy.try(function()
		return HttpService:RequestAsync({
			Url = API_URL,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
			},
			Body = body,
		})
	end)

	warn("🙏 redeem_voucher", ok, http_res)

	if not ok or typeof(http_res) ~= "table" then
		warn("[st_truemoney] http failed:", tostring(http_res))
		return false, nil
	end

	local decoded = Easy.safe_decode(http_res.Body)
	if not validate:table(decoded) or next(decoded) == nil then
		warn(`[st_truemoney] empty body HTTP {http_res.StatusCode}`)
		return false, nil
	end

	return true, decoded :: redeem_response
end

local processing = Easy.Session.new()
Players.PlayerRemoving:Connect(function(player)
	processing:remove(player)
end)

-- redeem voucher and add points
return function(player: Player, voucher_url: string)
	if not validate:player(player) then
		return false, "ผู้เล่นไม่ถูกต้อง"
	end

	if API_URL == "" then
		warn("[st_truemoney] API_URL is empty")
		return false, "ระบบเติมเงินยังไม่พร้อม"
	end

	if processing:find(player) then
		return false,
			"กำลังดำเนินการเติมเงิน โปรดรอสักครู่"
	end

	if not url_check(voucher_url) then
		return false, "ลิงค์ไม่ถูกต้อง"
	end

	if not points_service.get_session(player) then
		return false, "ไม่พบข้อมูล ลองเข้าใหม่"
	end

	processing:add(player)

	local phone = tostring(main.phone_number)
	if not phone:match("^0") then
		phone = "0" .. phone
	end
	local success, response = redeem_voucher(phone, voucher_url)

	if not (success and response) then
		processing:remove(player)
		return false, "ผิดพลาด โปรดลองอีกครั้ง"
	end

	if response.success and validate:table(response.data) then
		local amount = tonumber(response.data.amount)
		if not validate:number(amount) then
			processing:remove(player)
			return false, "จำนวนพ้อยต์ไม่ถูกต้อง"
		end

		local added = points_service.AddPoints(player, amount)
		processing:remove(player)

		if not added then
			return false, "เติมพ้อยต์ล้มเหลว"
		end

		local balance = points_service.GetPoints(player)
		webhook.send("PointTopup", {
			playerName = player.Name,
			userId = player.UserId,
			itemName = "TrueMoney Voucher",
			amount = amount,
			success = true,
			details = `balance: {balance}\nmessage: {response.message or "Success"}\nurl: {voucher_url}`,
		})

		return true, `เติมพ้อยต์สำเร็จ จำนวน {amount}x`
	end

	processing:remove(player)
	return false, response.message or "ผิดพลาด โปรดลองอีกครั้ง"
end
