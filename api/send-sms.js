export default async function handler(req, res) {

    /* ==========================================
       1. ЗӨВХӨН POST
    ========================================== */

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const SUPABASE_URL =
        process.env.SUPABASE_URL;

    const SUPABASE_SECRET =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const SENDSMS_API_KEY =
        process.env.SENDSMS_API_KEY;

    const SENDSMS_API_TOKEN =
        process.env.SENDSMS_API_TOKEN;


    /* ==========================================
       2. SERVER CONFIG ШАЛГАХ
    ========================================== */

    if (
        !SUPABASE_URL ||
        !SUPABASE_SECRET ||
        !SENDSMS_API_KEY ||
        !SENDSMS_API_TOKEN
    ) {
        return res.status(500).json({
            success: false,
            message: "Server configuration incomplete."
        });
    }


    /* ==========================================
       3. ACCESS TOKEN АВАХ
    ========================================== */

    const authHeader =
        req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Нэвтрээгүй хэрэглэгч."
        });
    }

    const accessToken =
        authHeader.slice(7).trim();

    if (!accessToken) {
        return res.status(401).json({
            success: false,
            message: "Access token байхгүй байна."
        });
    }


    /* ==========================================
       4. SUPABASE-ААС ХЭРЭГЛЭГЧИЙГ БАТАЛГААЖУУЛАХ
    ========================================== */

    let userId;

    try {

        const userResponse = await fetch(
            `${SUPABASE_URL}/auth/v1/user`,
            {
                method: "GET",

                headers: {
                    "apikey": SUPABASE_SECRET,
                    "Authorization":
                        `Bearer ${accessToken}`
                }
            }
        );

        if (!userResponse.ok) {

            return res.status(401).json({
                success: false,
                message:
                    "Хэрэглэгчийн нэвтрэлт хүчингүй байна."
            });

        }

        const user =
            await userResponse.json();

        userId = user.id;

        if (!userId) {

            return res.status(401).json({
                success: false,
                message:
                    "Хэрэглэгч тодорхойлогдсонгүй."
            });

        }

    } catch (error) {

        console.error(
            "Supabase auth error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Нэвтрэлтийг шалгахад алдаа гарлаа."
        });

    }


    /* ==========================================
       5. PHONE + MESSAGE ШАЛГАХ
    ========================================== */

    const {
        phone,
        message
    } = req.body || {};


    const cleanPhone =
        String(phone || "")
            .replace(/\D/g, "");


    if (!/^\d{8}$/.test(cleanPhone)) {

        return res.status(400).json({
            success: false,
            message:
                "Утасны дугаар 8 оронтой байх ёстой."
        });

    }


    const cleanMessage =
        String(message || "").trim();


    if (!cleanMessage) {

        return res.status(400).json({
            success: false,
            message:
                "Мессеж хоосон байна."
        });

    }


    if (cleanMessage.length > 159) {

        return res.status(400).json({
            success: false,
            message:
                "Мессеж 159 тэмдэгтээс их байна."
        });

    }


    /* ==========================================
       6. SMS ЭРХЭЭС 1 ХАСАХ
    ========================================== */

    let creditSource = null;

    try {

        const creditResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/consume_sms_credit`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "apikey":
                        SUPABASE_SECRET,

                    "Authorization":
                        `Bearer ${SUPABASE_SECRET}`
                },

                body: JSON.stringify({
                    p_user_id: userId
                })
            }
        );


        if (!creditResponse.ok) {

            const errorText =
                await creditResponse.text();

            console.error(
                "consume_sms_credit error:",
                errorText
            );

            return res.status(500).json({
                success: false,
                message:
                    "SMS эрх шалгахад алдаа гарлаа."
            });

        }


        creditSource =
            await creditResponse.json();


        if (creditSource === "none") {

            return res.status(402).json({
                success: false,
                code: "NO_SMS_CREDIT",
                message:
                    "SMS эрх хүрэлцэхгүй байна."
            });

        }


        if (
            creditSource !== "plan" &&
            creditSource !== "purchased"
        ) {

            console.error(
                "Unexpected credit source:",
                creditSource
            );

            return res.status(500).json({
                success: false,
                message:
                    "SMS эрхийн хариу буруу байна."
            });

        }

    } catch (error) {

        console.error(
            "SMS credit error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "SMS эрх шалгахад алдаа гарлаа."
        });

    }


    /* ==========================================
       7. REFUND HELPER
    ========================================== */

    async function refundCredit() {

        if (!creditSource) {
            return;
        }

        try {

            const refundResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/rpc/refund_sms_credit`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "apikey":
                                SUPABASE_SECRET,

                            "Authorization":
                                `Bearer ${SUPABASE_SECRET}`
                        },

                        body: JSON.stringify({
                            p_user_id:
                                userId,

                            p_source:
                                creditSource
                        })
                    }
                );


            if (!refundResponse.ok) {

                console.error(
                    "SMS refund failed:",
                    await refundResponse.text()
                );

            }

        } catch (error) {

            console.error(
                "SMS refund error:",
                error
            );

        }

    }


    /* ==========================================
       8. SENDSMS API РУУ ИЛГЭЭХ
    ========================================== */

    try {

        const smsResponse =
            await fetch(
                "https://api.sendsms.mn/api/user/send",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        apiKey:
                            SENDSMS_API_KEY,

                        apiToken:
                            SENDSMS_API_TOKEN,

                        phone:
                            cleanPhone,

                        message:
                            cleanMessage
                    })
                }
            );


        const responseText =
            await smsResponse.text();


        let providerData;

        try {

            providerData =
                JSON.parse(responseText);

        } catch {

            providerData = {
                response:
                    responseText
            };

        }


        /* ======================================
           9. SENDSMS HTTP ERROR → REFUND
        ====================================== */

        if (!smsResponse.ok) {

            await refundCredit();

            console.error(
                "SendSMS HTTP error:",
                providerData
            );

            return res
                .status(smsResponse.status)
                .json({
                    success: false,
                    message:
                        "SMS илгээж чадсангүй.",
                    provider:
                        providerData
                });

        }


        /* ======================================
           10. PROVIDER STATUS ШАЛГАХ
        ====================================== */

        if (
            providerData &&
            providerData.status !== undefined &&
            Number(providerData.status) !== 1
        ) {

            await refundCredit();

            console.error(
                "SendSMS provider error:",
                providerData
            );

            return res.status(400).json({
                success: false,
                message:
                    "SendSMS хүсэлтийг хүлээж авсангүй.",
                provider:
                    providerData
            });

        }


        /* ======================================
           11. АМЖИЛТТАЙ
        ====================================== */

        return res.status(200).json({

            success: true,

            message:
                "SMS амжилттай илгээгдлээ.",

            creditSource:
                creditSource,

            provider:
                providerData

        });


    } catch (error) {

        /* ======================================
           12. NETWORK / SERVER ERROR → REFUND
        ====================================== */

        await refundCredit();

        console.error(
            "SendSMS error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "SMS сервертэй холбогдоход алдаа гарлаа."
        });

    }

}
