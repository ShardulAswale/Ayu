import React from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { FoodEntry, mealImageRequest, workspaceApi } from './workspace-client';

type Candidate = { label:string; confidence:number };
async function sanitiseLocally(file: File): Promise<Blob> {
  if (file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP image smaller than 5 MB.');
  }
  const picture = await createImageBitmap(file);
  try {
    if (picture.width*picture.height > 20_000_000) throw new Error('Image dimensions exceed the allowed limit.');
    const scale = Math.min(1,1024/Math.max(picture.width,picture.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(picture.width*scale));
    canvas.height = Math.max(1,Math.round(picture.height*scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot process images');
    context.drawImage(picture,0,0,canvas.width,canvas.height);
    // Re-encoding removes metadata including source EXIF/GPS before it leaves the device.
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
      output=>output?resolve(output):reject(new Error('Unable to convert image')), 'image/webp',.8));
    if (blob.type !== 'image/webp') throw new Error('This browser cannot encode safe WebP images.');
    return blob;
  } finally { picture.close(); }
}
export function MealImagePanel({ entry, writable, onUpdated }: {
  entry: FoodEntry; writable: boolean; onUpdated:()=>void;
}) {
  const [preview,setPreview] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  const [suggestions,setSuggestions] = React.useState<Candidate[]>([]);
  React.useEffect(()=>{
    let active=true;let url='';
    setPreview('');setSuggestions([]);setError('');
    if (entry.imageId) void mealImageRequest(entry.id,'GET')
      .then(async r=>r.blob()).then(blob=>{
        if(!active)return;
        url=URL.createObjectURL(blob);setPreview(url);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Image unavailable');});
    return ()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[entry.id,entry.imageId]);
  const upload = async (file?:File) => {
    if (!file || busy) return;
    setBusy(true);setError('');
    try {
      const clean = await sanitiseLocally(file);
      await mealImageRequest(entry.id,'POST',clean);
      onUpdated();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Upload failed'); }
    finally{setBusy(false);}
  };
  const remove = async () => {
    if(!window.confirm('Remove this private meal photo?'))return;
    setBusy(true);setError('');
    try{await mealImageRequest(entry.id,'DELETE');onUpdated();}
    catch(cause){setError(cause instanceof Error?cause.message:'Remove failed');}
    finally{setBusy(false);}
  };
  const recognise = async () => {
    setBusy(true);setError('');setSuggestions([]);
    try{
      const data=await workspaceApi<{ candidates:Candidate[] }>('entries/'+entry.id+'/recognise','POST');
      setSuggestions(data.candidates);
    }catch(cause){setError(cause instanceof Error?cause.message:'Local recognition unavailable');}
    finally{setBusy(false);}
  };
  const apply = async (candidate:Candidate) => {
    if(entry.recipeId){setError('Remove the linked recipe using Edit before changing the food name.');return;}
    setBusy(true);setError('');
    try{
      await workspaceApi('entries/'+entry.id,'PATCH',{
        foodName:candidate.label,eatenAt:entry.eatenAt,quantity:entry.quantity,unit:entry.unit,
        notes:entry.notes || '',
      });
      setSuggestions([]);onUpdated();
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to apply suggestion');}
    finally{setBusy(false);}
  };
  return <details className="ws-meal-photo">
    <summary><Camera size={15}/> Meal photograph {entry.imageId?'· attached':'· optional'}</summary>
    <p>Images are processed privately. Automated recognition requires a configured local model and must be confirmed manually. Nutrition is not inferred from a photograph.</p>
    {error && <p role="alert" className="ws-meal-photo-error">{error}</p>}
    {entry.imageId && preview && <img alt={'Food diary photo for '+entry.foodName} src={preview} className="ws-meal-thumb"/>}
    {entry.imageId && !preview && !error && <span role="status">Loading private image…</span>}
    {writable && <div className="ws-inline-actions">
      <label className="ws-secondary ws-meal-upload"><ImagePlus size={14}/>{busy?'Processing…':entry.imageId?'Replace photograph':'Attach photograph'}
        <input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.currentTarget.value='';}}/>
      </label>
      {entry.imageId && <button type="button" className="ws-secondary" disabled={busy} onClick={()=>void recognise()}><RefreshCw size={14}/> Try local AI</button>}
      {entry.imageId && <button type="button" className="ws-secondary" disabled={busy} onClick={()=>void remove()}><Trash2 size={14}/> Remove</button>}
    </div>}
    {!!suggestions.length && <div className="ws-meal-suggestions"><strong>Unverified recognition suggestions</strong>
      {suggestions.map((suggestion,i)=><button key={i} type="button" disabled={busy}
        onClick={()=>void apply(suggestion)}>{suggestion.label} ({Math.round(suggestion.confidence*100)}%) · Use name</button>)}
      <small>Confirm the food and portion separately; suggestions do not calculate calories.</small>
    </div>}
  </details>;
}
