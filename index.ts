import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic=Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate=Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject=Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);
const db=createClient(supabaseUrl,serviceKey);

function aucklandParts(){
  const now=new Date();
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Pacific/Auckland",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"
  }).formatToParts(now);
  const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:`${x.year}-${x.month}-${x.day}`,hour:Number(x.hour)};
}
function addDay(iso){
  const d=new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}

Deno.serve(async()=>{
  const local=aucklandParts();
  // Cron can run hourly; only 7pm Auckland actually sends, automatically handling DST.
  if(local.hour!==19) return Response.json({ok:true,skipped:true,reason:"Not 7pm Auckland"});
  const tomorrow=addDay(local.date);

  const {data:rosters,error:rErr}=await db.from("user_roster").select("*").eq("shift_date",tomorrow);
  if(rErr) return Response.json({error:rErr.message},{status:500});
  let sent=0, failed=0;

  for(const roster of rosters||[]){
    const {data:already}=await db.from("notification_log")
      .select("user_id").eq("user_id",roster.user_id).eq("shift_date",tomorrow).maybeSingle();
    if(already) continue;

    const {data:subs}=await db.from("push_subscriptions")
      .select("*").eq("user_id",roster.user_id).eq("enabled",true);

    const text=(roster.shift_text||"").trim();
    const isOff=/^(RDO|OFF|LEAVE|AL|ALV|ALLV|SICK|SL)$/i.test(text);
    const body=isOff ? `Tomorrow (${tomorrow}): ${text}` : `Tomorrow's shift: ${text}`;

    let anySuccess=false;
    for(const s of subs||[]){
      try{
        await webpush.sendNotification(
          {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
          JSON.stringify({
            title:"VV Duty Roster",
            body,
            tag:`vv-shift-${tomorrow}`,
            url:"/"
          })
        );
        sent++; anySuccess=true;
      }catch(e){
        failed++;
        if(e?.statusCode===404 || e?.statusCode===410)
          await db.from("push_subscriptions").update({enabled:false}).eq("id",s.id);
      }
    }
    if(anySuccess) await db.from("notification_log").upsert({user_id:roster.user_id,shift_date:tomorrow});
  }
  return Response.json({ok:true,tomorrow,sent,failed});
});
