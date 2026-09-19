# The ashirwad artwork

`/ashirwad` sells a ₹501 digital darshan. After the offering clears, the
shankh is blown, the devotee's name travels into Bappa's ear, and Bappa
blesses them with light, petals, the bell and "Ganpati Bappa Morya!".

## The default: `bappa.jpg` (committed)

A pandal murti photographed in Dibrugarh during Ganesh Chaturthi 2024, by
**AjayDas**, from Wikimedia Commons, licensed **CC BY-SA 4.0**:
https://commons.wikimedia.org/wiki/File:The_idol_of_Lord_Ganesha_at_pandals_in_the_Paltan_Bazar_area_of_Dibrugarh_during_the_Ganesh_Chaturthi_celebrations_in_2024_17.jpg

Cropped to 4:5 and colour-graded from cold stage light to gold. The licence
allows commercial use. It requires attribution, which both pages show, and it
requires this adapted version to stay CC BY-SA 4.0.

It is committed because it is freely available on Commons anyway. What the
₹501 opens is the darshan experience, not a secret file.

Bappa's ear in this image, where the name is carried to, is at **62.5%, 47%**
(`DEFAULT_EAR` in `src/lib/ashirwad-image.ts`).

## Using your own, exclusive image instead

Never commit one: this repository is public. Everything in this directory
except this README and `bappa.jpg` is gitignored.

1. Upload it somewhere with an unguessable URL, e.g. Vercel Blob with a
   random suffix.
2. Set these in the Vercel environment:
   - `ASHIRWAD_IMAGE_URL`: that URL
   - `ASHIRWAD_EAR`: where Bappa's ear is, as `x,y` percentages
   - `ASHIRWAD_CREDIT`: attribution, if the image needs any
3. Run `npm run ashirwad:preview` to rebuild the blurred teaser, then commit
   `public/ashirwad/preview.jpg`.

## Sounds

- `public/ashirwad/shankh.m4a` / `.ogg`: a conch recorded by **David Bolton**
  for Wikipedia, **CC BY 2.5**:
  https://commons.wikimedia.org/wiki/File:Conch_shell.ogg
- "Ganpati Bappa Morya!" is spoken by the phone's own Marathi or Hindi voice.
  For a real recording, such as your family or your mandal chanting, save it
  as `public/ashirwad/morya.m4a` and it plays instead. Only use a recording you
  have the rights to.

## The blurred teaser

    npm run ashirwad:preview

This writes `public/ashirwad/preview.jpg`, a separate and genuinely
destroyed image (48px wide, then blurred and enlarged). WhatsApp shows it when
someone shares the link. Commit it.
