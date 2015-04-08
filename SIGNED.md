##### Signed by https://keybase.io/jasnell
```
-----BEGIN PGP SIGNATURE-----
Comment: GPGTools - https://gpgtools.org

iQEcBAABCgAGBQJVJIrvAAoJEHNBsVwHCHeseHIIAKeeVgckLbh/d6Aq5TPXD7Kc
kEDbtug9DsqafBrQ+zscfHEK731HgBGxRlyv08OfBn0UMipH9Pl/CqTcRmxOpG01
f2GNCzzAoHS/VEL/QxvL+pdEJAi1wIjxBBrrMRjP0GQhMbZfzuEK7wvzlD2VXENd
BadJfhZaLpaKKJQn//e3uehxFuOYwXOmzEN3D1vjb+i7NDRivJHj0IjLvqDaarOe
A5er8J12fgi7N+fFteE2kRaxptVJEvQB3QXX6rGbxrUBvb80pvIzoPvt8d1+E6TN
NnhEU9ce/WtOoQD3Xvx8bm+2iwRw7Ttad9hw7buOFfhT/sNMwDbuErV8pPdGViU=
=ELEX
-----END PGP SIGNATURE-----

```

<!-- END SIGNATURES -->

### Begin signed statement 

#### Expect

```
size   exec  file              contents                                                        
             ./                                                                                
13             .cfignore       16d30e4462189fb14dd611bdb708c510630c576a1f35b9383e89a4352da36c97
13             .gitignore      16d30e4462189fb14dd611bdb708c510630c576a1f35b9383e89a4352da36c97
58             .jshintrc       42a6d084ad98231f00e6c8a7c80a9a2f62e0d8404aba48e418e600eaaef2d92d
1621           app.js          f3a18f5b6edc029be53ea7c1b5ed161e921f3a7099d374ab1f08f88d4460ff84
               config/                                                                         
596              config.json   1fce26be05598df3f5b81ca40f6788295e81e34e1634346fd370d42b2f9feae2
1734             env.js        5c660a6b45e2d4dbd42382f3e2e333f819b167e638df10ae3ffb454b22d23326
2999           design_docs.js  7f9951edb5f48a9af1a7de157f8d42b4ada7451891c321ef2f790bde598ac1af
               lib/                                                                            
894              db.js         2036166d7ad64ff84d2f32e32d4c1cdb84c62c5999661ec60547029999a7d53d
1599             ldp.js        a9ca468b34c05aa73012bd0b00269c74e437cbf9a83347bf7bb4804eeb5a7dda
1001             media.js      b76b6c15db0e365b0705ebdc90afdb7267f67f125365f9880aaef021727116cb
344              problem.json  b8019f0500f45c50ce7c611b37a3d281c91ecff7f133a3dfce10e10dce226fb3
12660            service.js    bc458210d1880df0ad25d6814853747d75dd6f146ccf55b8942446821e2d944e
4930             store.js      e8ae457b1e2a8b2fecc6cb534a6fd3a1863989b9a8b4c2761ca6a045c8922dad
10870            utils.js      a5af37a57f258d788d35784a7ce57792fce1eee299c86b26f8edd6940e024e5a
107            manifest.yml    60d3aa65eca27e5614ec72486655d4aabe721ac7f26d4bd652fce724840273b2
545            package.json    54006975294092579041eec01475ea3f247c7133d26a807357fd0c3856dbf0dd
```

#### Ignore

```
/SIGNED.md
```

#### Presets

```
git      # ignore .git and anything as described by .gitignore files
dropbox  # ignore .dropbox-cache and other Dropbox-related files    
kb       # ignore anything as described by .kbignore files          
```

<!-- summarize version = 0.0.9 -->

### End signed statement

<hr>

#### Notes

With keybase you can sign any directory's contents, whether it's a git repo,
source code distribution, or a personal documents folder. It aims to replace the drudgery of:

  1. comparing a zipped file to a detached statement
  2. downloading a public key
  3. confirming it is in fact the author's by reviewing public statements they've made, using it

All in one simple command:

```bash
keybase dir verify
```

There are lots of options, including assertions for automating your checks.

For more info, check out https://keybase.io/docs/command_line/code_signing