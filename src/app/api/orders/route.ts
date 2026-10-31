import { NextResponse, type NextRequest, after } from "next/server";
import { assertSameOrigin } from "@/lib/auth";
import { orderCreateSchema } from "@/lib/validation";
import { createOrder, OrderError } from "@/lib/orders";
import { setOrderAccessCookie } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { notifyAdminsNewOrder } from "@/lib/notifications";
import { apiError, apiOk, errorResponse, requestIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await assertSameOrigin();
  } catch (error) {
    return errorResponse(error);
  }

  const ip = requestIp(request.headers);
  const limit = rateLimit(`order:create:${ip}`, 8, 60_000);
  if (!limit.allowed) {
    return apiError(429, "RATE_LIMITED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON");
  }

  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code =
      issue?.path[0] === "phone"
        ? "PHONE_INVALID"
        : issue?.path[0] === "name"
          ? "NAME_INVALID"
          : issue?.path[0] === "items"
            ? "ITEMS_INVALID"
            : "VALIDATION_ERROR";
    return apiError(400, code);
  }

  try {
    const result = await createOrder({
      items: parsed.data.items,
      name: parsed.data.name,
      phone: parsed.data.phone,
      locale: parsed.data.locale,
      paymentMethod: parsed.data.paymentMethod,
      idempotencyKey: parsed.data.idempotencyKey,
      note: parsed.data.note,
      couponCode: parsed.data.couponCode,
      ip,
    });

    await setOrderAccessCookie(result.reference);
    if (!result.duplicate) {
      after(async () => {
        await notifyAdminsNewOrder(result.order.id).catch((error) => {
          console.error("[orders] admin notification failed", error);
        });
      });
    }

    return apiOk(
      {
        reference: result.reference,
        duplicate: Boolean(result.duplicate),
      },
      201,
    );
  } catch (error) {
    if (error instanceof OrderError && error.code === "NO_STOCK") {
      return apiError(409, error.code, error.meta);
    }
    return errorResponse(error);
  }
}

export function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
