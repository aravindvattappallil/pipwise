import {getCurrentUser} from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getCurrentUser();
 return Response.json(user?{authenticated:true,user:{id:user.userId,name:user.displayName}}:{authenticated:false},{status:user?200:401,headers:{'Cache-Control':'private,no-store'}});
}
