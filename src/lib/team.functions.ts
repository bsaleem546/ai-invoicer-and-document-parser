import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// db() casts supabaseAdmin to any — needed until types are regenerated after migration
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const MAX_SEATS = 5;

export const getTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await db();
    const { userId } = context;

    const { data: ownedTeam } = await supabaseAdmin
      .from("teams")
      .select("*, team_members(*)")
      .eq("owner_id", userId)
      .maybeSingle();

    if (ownedTeam) return { team: ownedTeam, role: "owner" as const };

    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("*, teams(*, team_members(*))")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.teams) return { team: membership.teams, role: "member" as const };

    return { team: null, role: null };
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => z.object({ name: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await db();
    const { userId } = context;

    const { data: existing } = await supabaseAdmin.from("teams").select("id").eq("owner_id", userId).maybeSingle();
    if (existing) throw new Error("You already have a team.");

    const { data: team, error } = await supabaseAdmin
      .from("teams")
      .insert({ name: data.name, owner_id: userId })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from("team_members").insert({
      team_id: team.id,
      user_id: userId,
      invited_email: "",
      role: "owner",
      status: "active",
    });

    await supabaseAdmin.from("profiles").update({ team_id: team.id }).eq("id", userId);

    return { team };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await db();
    const { userId } = context;

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, team_members(*)")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!team) throw new Error("You must create a team first.");

    const members = (team.team_members as any[]) ?? [];
    if (members.length >= MAX_SEATS) throw new Error(`Team is full (${MAX_SEATS} seats max).`);

    const alreadyInvited = members.some((m: any) => m.invited_email === data.email);
    if (alreadyInvited) throw new Error("This email has already been invited.");

    const { error: inviteErr } = await supabaseAdmin.from("team_members").insert({
      team_id: team.id,
      invited_email: data.email,
      role: "member",
      status: "pending",
    });
    if (inviteErr) throw inviteErr;

    // If user already exists, link them immediately
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existing = users.find((u: any) => u.email === data.email);
    if (existing) {
      await supabaseAdmin.from("team_members")
        .update({ user_id: existing.id, status: "active" })
        .eq("team_id", team.id)
        .eq("invited_email", data.email);
      await supabaseAdmin.from("profiles").update({ team_id: team.id }).eq("id", existing.id);
    } else {
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { team_id: team.id },
      });
    }

    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string }) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await db();
    const { userId } = context;

    const { data: team } = await supabaseAdmin.from("teams").select("id").eq("owner_id", userId).maybeSingle();
    if (!team) throw new Error("Not authorized.");

    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("user_id, role")
      .eq("id", data.memberId)
      .eq("team_id", team.id)
      .maybeSingle();
    if (!member) throw new Error("Member not found.");
    if (member.role === "owner") throw new Error("Cannot remove the team owner.");

    await supabaseAdmin.from("team_members").delete().eq("id", data.memberId);

    if (member.user_id) {
      await supabaseAdmin.from("profiles").update({ team_id: null }).eq("id", member.user_id);
    }

    return { ok: true };
  });
