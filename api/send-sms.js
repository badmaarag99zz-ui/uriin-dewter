export default async function handler(req, res) {
    // Зөвхөн POST хүсэлт зөвшөөрнө
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const { phone, message } = req.body || {};

        // Утас шалгах
        if (!phone || !/^\d{8}$/.test(String(phone))) {
            return res.status(400).json({
                success: false,
                message: "Утасны дугаар 8 оронтой байх ёстой."
            });
        }

        // Мессеж шалгах
        if (!message || typeof message !== "string") {
            return res.status(400).json({
                success: false,
                message: "Мессеж хоосон байна."
            });
        }

        if (message.length > 159) {
            return res.status(400).json({
                success: false,
                message: "Мессеж 159 тэмдэгтээс их байж болохгүй."
            });
        }

        const apiKey = process.env.SENDSMS_API_KEY;
        const apiToken = process.env.SENDSMS_API_TOKEN;

        if (!apiKey || !apiToken) {
            return res.status(500).json({
                success: false,
                message: "SendSMS API тохиргоо дутуу байна."
            });
        }

        const response = await fetch(
            "https://api.sendsms.mn/api/user/send",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    apiToken: apiToken,
                    phone: String(phone),
                    message: message
                })
            }
        );

        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            data = { response: text };
        }

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: "SendSMS мессеж илгээж чадсангүй.",
                provider: data
            });
        }

        return res.status(200).json({
            success: true,
            message: "SMS амжилттай илгээгдлээ.",
            provider: data
        });

    } catch (error) {
        console.error("SendSMS error:", error);

        return res.status(500).json({
            success: false,
            message: "SMS серверийн алдаа гарлаа."
        });
    }
}
