// ============================================================================
// TA5MENA (TOP 10) - SUGGESTIONS DICTIONARY & SEARCH ENGINE
// Comprehensive database of Egyptian, Arab, and International entries
// across Singers, Football Players, and Actors.
// Supports English, Arabic, and Franco search terms.
// ============================================================================

export const SUGGESTIONS = {
  singers: [
    // Egyptian & Arab Icons
    { name: "Amr Diab", ar: "عمرو دياب" },
    { name: "Tamer Hosny", ar: "تامر حسني" },
    { name: "Wegz", ar: "ويجز" },
    { name: "Marwan Pablo", ar: "مروان بابلو" },
    { name: "Cairokee", ar: "كايروكي" },
    { name: "Amir Eid", ar: "أمير عيد" },
    { name: "Sherine Abdel Wahab", ar: "شيرين عبد الوهاب" },
    { name: "Angham", ar: "أنغام" },
    { name: "Mohamed Mounir", ar: "محمد منير" },
    { name: "Umm Kulthum", ar: "أم كلثوم" },
    { name: "Abdel Halim Hafez", ar: "عبد الحليم حافظ" },
    { name: "Fairuz", ar: "فيروز" },
    { name: "Lege-Cy", ar: "ليجي-سي" },
    { name: "Afroto", ar: "عفروتو" },
    { name: "Marwan Moussa", ar: "مروان موسى" },
    { name: "Essam Sasa", ar: "عصام صاصا" },
    { name: "Bahaa Sultan", ar: "بهاء سلطان" },
    { name: "Elissa", ar: "إليسا" },
    { name: "Nancy Ajram", ar: "نانسي عجرم" },
    { name: "Kadim Al Sahir", ar: "كاظم الساهر" },
    { name: "Asala Nasri", ar: "أصالة نصري" },
    { name: "Wael Kfoury", ar: "وائل كفوري" },
    { name: "Majid Al Mohandis", ar: "ماجد المهندس" },
    { name: "Hussain Al Jassmi", ar: "حسين الجسمي" },
    { name: "Hamza Namira", ar: "حمزة نمرة" },
    { name: "Ahmed Saad", ar: "أحمد سعد" },
    { name: "Ruby", ar: "روبي" },
    { name: "Mahmoud El Esseily", ar: "محمود العسيلي" },
    { name: "Samira Said", ar: "سميرة سعيد" },
    { name: "George Wassouf", ar: "جورج وسوف" },
    { name: "Cheb Khaled", ar: "الشاب خالد" },
    { name: "Cheb Mami", ar: "الشاب مامي" },
    { name: "Mohamed Ramadan", ar: "محمد رمضان" },
    { name: "Muslim", ar: "مسلم" },
    { name: "Tul8te", ar: "توليت" },
    { name: "Siilawy", ar: "سيلاوي" },
    { name: "Massar Egbari", ar: "مسار إجباري" },
    { name: "Sharmoofers", ar: "شارموفرز" },
    { name: "Ramy Sabry", ar: "رامي صبري" },
    { name: "Hassan Shakosh", ar: "حسن شاكوش" },
    { name: "Omar Kamal", ar: "عمر كمال" },
    { name: "Hamo Bika", ar: "حمو بيكا" },
    { name: "Ahmed Sheba", ar: "أحمد شيبة" },
    { name: "Hakim", ar: "حكيم" },
    { name: "Mostafa Amar", ar: "مصطفى قمر" },
    { name: "Ehab Tawfik", ar: "إيهاب توفيق" },
    { name: "Hisham Abbas", ar: "هشام عباس" },
    { name: "Mohamed Hamaki", ar: "محمد حماقي" },
    { name: "Fadel Chaker", ar: "فضل شاكر" },
    { name: "Saber Rebai", ar: "صابر الرباعي" },
    { name: "Ragheb Alama", ar: "راغب علامة" },
    { name: "Nawal Al Zoghbi", ar: "نوال الزغبي" },
    { name: "Haifa Wehbe", ar: "هيفاء وهبي" },
    { name: "Myriam Fares", ar: "ميريام فارس" },
    { name: "Carole Samaha", ar: "كارول سماحة" },
    { name: "Warda Al-Jazairia", ar: "وردة الجزائرية" },
    { name: "Farid Al-Atrash", ar: "فريد الأطرش" },
    { name: "Mohamed Abdel Wahab", ar: "محمد عبد الوهاب" },
    { name: "Sayed Darwish", ar: "سيد درويش" },
    { name: "Sabah", ar: "صباح" },
    { name: "Najat Al Saghira", ar: "نجاة الصغيرة" },
    { name: "Faia Younan", ar: "فايا يونان" },
    { name: "Balti", ar: "بلطي" },
    { name: "ElGrandeToto", ar: "الجراندي طوطو" },
    { name: "Dizzy DROS", ar: "ديزي دروس" },
    { name: "Inkonnu", ar: "إنكونو" },
    { name: "A.L.A", ar: "إيه إل إيه" },
    { name: "Samara", ar: "سمارة" },
    { name: "Kafon", ar: "كافون" },
    { name: "Shabjdeed", ar: "شب جديد" },
    { name: "Synaptik", ar: "السينابتيك" },
    { name: "Muqata'a", ar: "مقاطعة" },
    { name: "Al Nather", ar: "الناظر" },
    { name: "Donia Wael", ar: "دنيا وائل" },
    { name: "Perrie", ar: "بيري" },
    { name: "Dina El Wedidi", ar: "دينا الوديدي" },
    { name: "Youssra El Hawary", ar: "يسرا الهواري" },
    { name: "Abo El Anwar", ar: "أبو الأنوار" },
    { name: "Lil Baba", ar: "ليل بابا" },
    { name: "Dasha", ar: "داشا" },
    { name: "Ziad Zaza", ar: "زياد ظاظا" },
    { name: "Fl EX", ar: "فليكس" },
    { name: "Wingii", ar: "وينجي" },
    { name: "Husayn", ar: "حسين" },
    { name: "Batistuta", ar: "باتيستوتا" },
    { name: "Mousv", ar: "موسى في" },

    // International Artists
    { name: "The Weeknd", ar: "ذا ويكند" },
    { name: "Drake", ar: "دريك" },
    { name: "Travis Scott", ar: "ترافيس سكوت" },
    { name: "Taylor Swift", ar: "تايلور سويفت" },
    { name: "Billie Eilish", ar: "بيلي إيليش" },
    { name: "Eminem", ar: "إمينيم" },
    { name: "Kanye West", ar: "كانييه ويست" },
    { name: "Kendrick Lamar", ar: "كندريك لامار" },
    { name: "Lana Del Rey", ar: "لانا ديل ري" },
    { name: "Post Malone", ar: "بوست مالون" },
    { name: "Adele", ar: "أديل" },
    { name: "Rihanna", ar: "ريانا" },
    { name: "Bruno Mars", ar: "برونو مارس" },
    { name: "Coldplay", ar: "كولدبلاي" },
    { name: "Justin Bieber", ar: "جاستن بيبر" },
    { name: "Ed Sheeran", ar: "إد شيران" },
    { name: "Ariana Grande", ar: "أريانا جراندي" },
    { name: "Dua Lipa", ar: "دوا ليبا" },
    { name: "Beyonce", ar: "بيونسيه" },
    { name: "Harry Styles", ar: "هاري ستايلز" },
    { name: "SZA", ar: "سيزا" },
    { name: "Frank Ocean", ar: "فرانك أوشن" },
    { name: "J. Cole", ar: "جي كول" },
    { name: "Lady Gaga", ar: "ليدي جاجا" },
    { name: "Michael Jackson", ar: "مايكل جاكسون" },
    { name: "Queen", ar: "كوين" },
    { name: "Freddie Mercury", ar: "فريدي ميركوري" },
    { name: "Arctic Monkeys", ar: "أركتيك مونكيز" },
    { name: "Imagine Dragons", ar: "إيماجين دراجونز" },
    { name: "Linkin Park", ar: "لينكين بارك" },
    { name: "Chester Bennington", ar: "تشيستر بينينجتون" },
    { name: "Nirvana", ar: "نيرفانا" },
    { name: "Kurt Cobain", ar: "كيرت كوبين" },
    { name: "2Pac", ar: "توباك شاكور" },
    { name: "The Notorious B.I.G.", ar: "بيجي سمولز" },
    { name: "Jay-Z", ar: "جي زي" },
    { name: "Nas", ar: "ناس" },
    { name: "Snoop Dogg", ar: "سنوب دوج" },
    { name: "50 Cent", ar: "فيفتي سينت" },
    { name: "Lil Wayne", ar: "ليل وين" },
    { name: "Future", ar: "فيوتشر" },
    { name: "Metro Boomin", ar: "ميترو بومين" },
    { name: "21 Savage", ar: "توني ون سافاج" },
    { name: "Tyler, The Creator", ar: "تايلر ذا كريتور" },
    { name: "Childish Gambino", ar: "دونالد جلوفر" },
    { name: "Mac Miller", ar: "ماك ميلر" },
    { name: "Juice WRLD", ar: "جوس عالم" },
    { name: "XXXTentacion", ar: "إكس إكس إكس تينتاسيون" },
    { name: "Playboi Carti", ar: "بلايبوي كارتي" },
    { name: "Lil Uzi Vert", ar: "ليل أوزي فيرت" },
    { name: "A$AP Rocky", ar: "إيساب روكي" },
    { name: "Olivia Rodrigo", ar: "أوليفيا رودريجو" },
    { name: "Sabrina Carpenter", ar: "سابرينا كاربنتر" },
    { name: "Chappell Roan", ar: "شابيل روان" },
    { name: "Charli XCX", ar: "شارلي إكس سي إكس" },
    { name: "Katy Perry", ar: "كيتي بيري" },
    { name: "Britney Spears", ar: "بريتني سبيرز" },
    { name: "Shakira", ar: "شاكيرا" },
    { name: "Bad Bunny", ar: "باد باني" },
    { name: "Rosalia", ar: "روزاليا" },
    { name: "J Balvin", ar: "جي بالفين" },
    { name: "Daddy Yankee", ar: "دادي يانكي" },
    { name: "Maluma", ar: "مالوما" },
    { name: "The Beatles", ar: "البيتلز" },
    { name: "Pink Floyd", ar: "بينك فلويد" },
    { name: "Led Zeppelin", ar: "ليد زيبلين" },
    { name: "David Bowie", ar: "ديفيد باوي" },
    { name: "Elton John", ar: "إلتون جون" },
    { name: "Stevie Wonder", ar: "ستيفي واندر" },
    { name: "Prince", ar: "برنس" },
    { name: "Bob Marley", ar: "بوب مارلي" },
    { name: "Whitney Houston", ar: "ويتني هيوستن" },
    { name: "Mariah Carey", ar: "ماريا كاري" },
    { name: "Celine Dion", ar: "سيلين ديون" },
    { name: "Sia", ar: "سيا" },
    { name: "Sam Smith", ar: "سام سميث" },
    { name: "Shawn Mendes", ar: "شون مينديز" },
    { name: "Camila Cabello", ar: "كاميلا كابيلو" },
    { name: "Selena Gomez", ar: "سيلينا جوميز" },
    { name: "Miley Cyrus", ar: "مايلي سايرس" },
    { name: "Doja Cat", ar: "دوجا كات" },
    { name: "Megan Thee Stallion", ar: "ميجان ذي ستاليون" },
    { name: "Cardi B", ar: "كاردي بي" },
    { name: "Nicki Minaj", ar: "نيكي ميناج" }
  ],

  football: [
    // Egyptian & Arab Stars
    { name: "Mohamed Salah", ar: "محمد صلاح" },
    { name: "Omar Marmoush", ar: "عمر مرموش" },
    { name: "Mahmoud Trezeguet", ar: "محمود تريزيجيه" },
    { name: "Mohamed Aboutrika", ar: "محمد أبو تريكة" },
    { name: "Ahmed Sayed Zizo", ar: "أحمد سيد زيزو" },
    { name: "Emam Ashour", ar: "إمام عاشور" },
    { name: "Mohamed El Shenawy", ar: "محمد الشناوي" },
    { name: "Essam El Hadary", ar: "عصام الحضري" },
    { name: "Mahmoud Shikabala", ar: "محمود شيكابالا" },
    { name: "Achraf Hakimi", ar: "أشرف حكيمي" },
    { name: "Riyad Mahrez", ar: "رياض محرز" },
    { name: "Yassine Bounou", ar: "ياسين بونو" },
    { name: "Hakim Ziyech", ar: "حكيم زياش" },
    { name: "Ismael Bennacer", ar: "إسماعيل بن ناصر" },
    { name: "Sofyan Amrabat", ar: "سفيان أمرابط" },
    { name: "Azzedine Ounahi", ar: "عز الدين أوناحي" },
    { name: "Youssef En-Nesyri", ar: "يوسف النصيري" },
    { name: "Salem Al-Dawsari", ar: "سالم الدوسري" },
    { name: "Baghdad Bounedjah", ar: "بغداد بونجاح" },
    { name: "Youcef Belaili", ar: "يوسف بلايلي" },
    { name: "Mostafa Mohamed", ar: "مصطفى محمد" },
    { name: "Ahmed Hegazi", ar: "أحمد حجازي" },
    { name: "Mohamed Elneny", ar: "محمد النني" },
    { name: "Wael Gomaa", ar: "وائل جمعة" },
    { name: "Hossam Hassan", ar: "حسام حسن" },
    { name: "Ibrahim Hassan", ar: "إبراهيم حسن" },
    { name: "Hossam Ghaly", ar: "حسام غالي" },
    { name: "Mohamed Barakat", ar: "محمد بركات" },
    { name: "Emad Moteab", ar: "عماد متعب" },
    { name: "Amr Zaki", ar: "عمرو زكي" },
    { name: "Ahmed Hossam Mido", ar: "أحمد حسام ميدو" },
    { name: "Ramadan Sobhi", ar: "رمضان صبحي" },
    { name: "Mohamed Magdy Afsha", ar: "محمد مجدي أفشة" },
    { name: "Ali Maaloul", ar: "علي معلول" },
    { name: "Achraf Bencharki", ar: "أشرف بن شرقي" },
    { name: "Ferjani Sassi", ar: "فرجاني ساسي" },
    { name: "Tarek Hamed", ar: "طارق حامد" },
    { name: "Ahmed Fathi", ar: "أحمد فتحي" },
    { name: "Sayed Moawad", ar: "سيد معوض" },
    { name: "Hazem Emam", ar: "حازم إمام" },
    { name: "Mahmoud El Khatib", ar: "محمود الخطيب" },
    { name: "Taher Abouzaid", ar: "طاهر أبو زيد" },
    { name: "Farouk Gaafar", ar: "فاروق جعفر" },
    { name: "Hassan Shehata", ar: "حسن شحاتة" },
    { name: "Youssef Msakni", ar: "يوسف المساكني" },
    { name: "Wahbi Khazri", ar: "وهبي الخزري" },
    { name: "Aissa Mandi", ar: "عيسى ماندي" },
    { name: "Ramy Bensebaini", ar: "رامي بن سبعيني" },
    { name: "Saud Abdulhamid", ar: "سعود عبد الحميد" },
    { name: "Firas Al-Buraikan", ar: "فراس البريكان" },
    { name: "Nawaf Al-Abed", ar: "نواف العابد" },
    { name: "Yasser Al-Qahtani", ar: "ياسر القحطاني" },
    { name: "Sami Al-Jaber", ar: "سامي الجابر" },
    { name: "Majed Abdullah", ar: "ماجد عبد الله" },
    { name: "Mohamed Kanno", ar: "محمد كنو" },
    { name: "Akram Afif", ar: "أكرم عفيف" },
    { name: "Almoez Ali", ar: "المعز علي" },
    { name: "Hassan Al-Haydos", ar: "حسن الهيدوس" },
    { name: "Aymen Hussein", ar: "أيمن حسين" },
    { name: "Younis Mahmoud", ar: "يونس محمود" },
    { name: "Nashat Akram", ar: "نشأت أكرم" },
    { name: "Ali Mabkhout", ar: "علي مبخوت" },
    { name: "Omar Abdulrahman (Amoory)", ar: "عمر عبد الرحمن عموري" },
    { name: "Omar Khribin", ar: "عمر خربين" },
    { name: "Omar Al Somah", ar: "عمر السومة" },

    // Global Football Stars
    { name: "Lionel Messi", ar: "ليونيل ميسي" },
    { name: "Cristiano Ronaldo", ar: "كريستيانو رونالدو" },
    { name: "Kylian Mbappe", ar: "كيليان مبابي" },
    { name: "Erling Haaland", ar: "إيرلينج هالاند" },
    { name: "Vinicius Jr", ar: "فينيسيوس جونيور" },
    { name: "Jude Bellingham", ar: "جود بيلينجهام" },
    { name: "Kevin De Bruyne", ar: "كيفين دي بروين" },
    { name: "Neymar", ar: "نيمار" },
    { name: "Luka Modric", ar: "لوكا مودريتش" },
    { name: "Karim Benzema", ar: "كريم بنزيما" },
    { name: "Ronaldinho", ar: "رونالدينيو" },
    { name: "Zinedine Zidane", ar: "زين الدين زيدان" },
    { name: "Ronaldo Nazario", ar: "رونالدو البرازيلي" },
    { name: "Thierry Henry", ar: "تييري هنري" },
    { name: "Kaka", ar: "كاكا" },
    { name: "Andres Iniesta", ar: "أندريس إنييستا" },
    { name: "Xavi Hernandez", ar: "تشافي هيرنانديز" },
    { name: "Sergio Ramos", ar: "سيرجيو راموس" },
    { name: "Virgil van Dijk", ar: "فيرجيل فان دايك" },
    { name: "Manuel Neuer", ar: "مانويل نوير" },
    { name: "Robert Lewandowski", ar: "روبرت ليفاندوفسكي" },
    { name: "Harry Kane", ar: "هاري كين" },
    { name: "Phil Foden", ar: "فيل فودين" },
    { name: "Rodri", ar: "رودري" },
    { name: "Toni Kroos", ar: "توني كروس" },
    { name: "Gianluigi Buffon", ar: "جانلويجي بوفون" },
    { name: "Paolo Maldini", ar: "باولو مالديني" },
    { name: "Andrea Pirlo", ar: "أندريا بيرلو" },
    { name: "Zlatan Ibrahimovic", ar: "زلاتان إبراهيموفيتش" },
    { name: "David Beckham", ar: "ديفيد بيكهام" },
    { name: "Pele", ar: "بيليه" },
    { name: "Diego Maradona", ar: "دييجو مارادونا" },
    { name: "Johan Cruyff", ar: "يوهان كرويف" },
    { name: "Franz Beckenbauer", ar: "فرانز بيكنباور" },
    { name: "George Best", ar: "جورج بيست" },
    { name: "Michel Platini", ar: "ميشيل بلاتيني" },
    { name: "Marco van Basten", ar: "ماركو فان باستن" },
    { name: "Roberto Baggio", ar: "روبرتو باجيو" },
    { name: "Dennis Bergkamp", ar: "دينيس بيركامب" },
    { name: "Wayne Rooney", ar: "واين روني" },
    { name: "Steven Gerrard", ar: "ستيفن جيرارد" },
    { name: "Frank Lampard", ar: "فرانك لامبارد" },
    { name: "Paul Scholes", ar: "بول سكولز" },
    { name: "Ryan Giggs", ar: "ريان جيجز" },
    { name: "Didier Drogba", ar: "ديدييه دروجبا" },
    { name: "Samuel Eto'o", ar: "صامويل إيتو" },
    { name: "Yaya Toure", ar: "يايا توريه" },
    { name: "Sadio Mane", ar: "ساديو ماني" },
    { name: "Lamine Yamal", ar: "لامين يامال" },
    { name: "Cole Palmer", ar: "كول بالمر" },
    { name: "Florian Wirtz", ar: "فلوريان فيرتز" },
    { name: "Jamal Musiala", ar: "جمال موسيالا" },
    { name: "Bukayo Saka", ar: "بوكايو ساكا" },
    { name: "Martin Odegaard", ar: "مارتن أوديغارد" },
    { name: "Declan Rice", ar: "ديكلان رايس" },
    { name: "William Saliba", ar: "ويليام ساليبا" },
    { name: "Ruben Dias", ar: "روبن دياز" },
    { name: "Bernardo Silva", ar: "برناردو سيلفا" },
    { name: "Bruno Fernandes", ar: "برونو فيرنانديز" },
    { name: "Rafael Leao", ar: "رافائيل لياو" },
    { name: "Lautaro Martinez", ar: "لاوتارو مارتينيز" },
    { name: "Julian Alvarez", ar: "خوليان ألفاريز" },
    { name: "Antoine Griezmann", ar: "أنطوان جريزمان" },
    { name: "Son Heung-min", ar: "سون هيونج مين" },
    { name: "Alisson Becker", ar: "أليسون بيكر" },
    { name: "Thibaut Courtois", ar: "تيبو كورتوا" },
    { name: "Ederson", ar: "إيدرسون" },
    { name: "Marc-Andre ter Stegen", ar: "مارك أندريه تير شتيجن" },
    { name: "Emiliano Martinez", ar: "إيميليانو مارتينيز" },
    { name: "Carles Puyol", ar: "كارليس بويول" },
    { name: "Gerard Pique", ar: "جيرارد بيكيه" },
    { name: "Dani Alves", ar: "داني ألفيس" },
    { name: "Marcelo", ar: "مارسيلو" },
    { name: "Roberto Carlos", ar: "روبرتو كارلوس" },
    { name: "Cafu", ar: "كافو" },
    { name: "Gareth Bale", ar: "جاريث بيل" },
    { name: "Eden Hazard", ar: "إيدين هازارد" },
    { name: "Luis Suarez", ar: "لويس سواريز" },
    { name: "Sergio Aguero", ar: "سيرجيو أجويرو" },
    { name: "Radamel Falcao", ar: "راداميل فالكاو" },
    { name: "Edinson Cavani", ar: "إدينسون كافاني" },
    { name: "Arjen Robben", ar: "آريين روبن" },
    { name: "Franck Ribery", ar: "فرانك ريبيري" },
    { name: "Mesut Ozil", ar: "مسعود أوزيل" },
    { name: "Thomas Muller", ar: "توماس مولر" },
    { name: "Bastian Schweinsteiger", ar: "باستيان شفاينشتايجر" },
    { name: "Casemiro", ar: "كاسيميرو" },
    { name: "N'Golo Kante", ar: "نجولو كانتي" },
    { name: "Paul Pogba", ar: "بول بوجبا" },
    { name: "Angel Di Maria", ar: "أنخيل دي ماريا" },
    { name: "Javier Zanetti", ar: "خافيير زانيتي" }
  ],

  actors: [
    // Egyptian Stars
    { name: "Adel Emam", ar: "عادل إمام" },
    { name: "Karim Abdel Aziz", ar: "كريم عبد العزيز" },
    { name: "Ahmed Ezz", ar: "أحمد عز" },
    { name: "Ahmed Helmy", ar: "أحمد حلمي" },
    { name: "Mohamed Henedy", ar: "محمد هنيدي" },
    { name: "Maged El Kedwany", ar: "ماجد الكدواني" },
    { name: "Amir Karara", ar: "أمير كرارة" },
    { name: "Mohamed Ramadan", ar: "محمد رمضان" },
    { name: "Yasmin Abdelaziz", ar: "ياسمين عبد العزيز" },
    { name: "Mona Zaki", ar: "منى زكي" },
    { name: "Hend Sabry", ar: "هند صبري" },
    { name: "Asser Yassin", ar: "آسر ياسين" },
    { name: "Taha Desouky", ar: "طه دسوقي" },
    { name: "Hesham Maged", ar: "هشام ماجد" },
    { name: "Chico", ar: "شيكو" },
    { name: "Ahmed Fahmy", ar: "أحمد فهمي" },
    { name: "Akram Hosny", ar: "أكرم حسني" },
    { name: "Nour El Sherif", ar: "نور الشريف" },
    { name: "Ahmed Zaki", ar: "أحمد زكي" },
    { name: "Mahmoud Abdel Aziz", ar: "محمود عبد العزيز" },
    { name: "Omar Sharif", ar: "عمر الشريف" },
    { name: "Soad Hosny", ar: "سعاد حسني" },
    { name: "Faten Hamama", ar: "فاتن حمامة" },
    { name: "Yehia El Fakharany", ar: "يحيى الفخراني" },
    { name: "Khaled El Nabawy", ar: "خالد النبوي" },
    { name: "Khaled El Sawy", ar: "خالد الصاوي" },
    { name: "Menna Shalaby", ar: "منة شلبي" },
    { name: "Nelly Karim", ar: "نيللي كريم" },
    { name: "Dorra", ar: "درة" },
    { name: "Tara Emad", ar: "تارا عماد" },
    { name: "Bayoumi Fouad", ar: "بيومي فؤاد" },
    { name: "Sayed Ragab", ar: "سيد رجب" },
    { name: "Bassem Samra", ar: "باسم سمرة" },
    { name: "Mohamed Mamdouh", ar: "محمد ممدوح" },
    { name: "Amr Youssef", ar: "عمرو يوسف" },
    { name: "Youssef El Sherif", ar: "يوسف الشريف" },
    { name: "Tamer Hosny", ar: "تامر حسني" },
    { name: "Hani Salama", ar: "هاني سلامة" },
    { name: "Mostafa Shaban", ar: "مصطفى شعبان" },
    { name: "Mohamed Emam", ar: "محمد إمام" },
    { name: "Ahmed El Sakka", ar: "أحمد السقا" },
    { name: "Ahmed Dawood", ar: "أحمد داود" },
    { name: "Amr Abdel Gelil", ar: "عمرو عبد الجليل" },
    { name: "Sherif Mounir", ar: "شريف منير" },
    { name: "Fathy Abdel Wahab", ar: "فتحي عبد الوهاب" },
    { name: "Tarek Lotfy", ar: "طارق لطفي" },
    { name: "Eyad Nassar", ar: "إياد نصار" },
    { name: "Dhafer L'Abidine", ar: "ظافر العابدين" },
    { name: "Taim Hasan", ar: "تيم حسن" },
    { name: "Kosai Khauli", ar: "قصي خولي" },
    { name: "Bassel Khaiat", ar: "باسل خياط" },
    { name: "Maxim Khalil", ar: "مكسيم خليل" },
    { name: "Cyrine Abdelnour", ar: "سيرين عبد النور" },
    { name: "Nadine Nassib Njeim", ar: "نادين نسيب نجيم" },
    { name: "Sulafa Mimar", ar: "سلافة معمار" },
    { name: "Ghada Abdel Razek", ar: "غادة عبد الرازق" },
    { name: "Mai Ezz Eldin", ar: "مي عز الدين" },
    { name: "Donia Samir Ghanem", ar: "دنيا سمير غانم" },
    { name: "Amy Samir Ghanem", ar: "إيمي سمير غانم" },
    { name: "Samir Ghanem", ar: "سمير غانم" },
    { name: "Dalal Abdel Aziz", ar: "دلال عبد العزيز" },
    { name: "Ragaa El Geddawy", ar: "رجاء الجداوي" },
    { name: "Youssef Wahbi", ar: "يوسف وهبي" },
    { name: "Naguib El Rihani", ar: "نجيب الريحاني" },
    { name: "Ismail Yassine", ar: "إسماعيل ياسين" },
    { name: "Fouad El Mohandes", ar: "فؤاد المهندس" },
    { name: "Shwikar", ar: "شويكار" },
    { name: "Rushdy Abaza", ar: "رشدي أباظة" },
    { name: "Shadia", ar: "شادية" },
    { name: "Hend Rostom", ar: "هند رستم" },
    { name: "Salah Zulfikar", ar: "صلاح ذو الفقار" },
    { name: "Shukry Sarhan", ar: "شكري سرحان" },
    { name: "Ahmed Mazhar", ar: "أحمد مظهر" },
    { name: "Mahmoud Yassin", ar: "محمود ياسين" },
    { name: "Hussein Fahmy", ar: "حسين فهمي" },
    { name: "Farouk El Fishawy", ar: "فاروق الفيشاوي" },
    { name: "Ahmed El Fishawy", ar: "أحمد الفيشاوي" },
    { name: "Nasser El Qasabi", ar: "ناصر القصبي" },
    { name: "Abdullah Al-Sadhan", ar: "عبد الله السدحان" },
    { name: "Abdulhussain Abdulredha", ar: "عبد الحسين عبد الرضا" },
    { name: "Hayat Al-Fahad", ar: "حياة الفهد" },
    { name: "Souad Abdullah", ar: "سعاد عبد الله" },

    // Global Hollywood & International Stars
    { name: "Leonardo DiCaprio", ar: "ليوناردو دي كابريو" },
    { name: "Cillian Murphy", ar: "كيليان مورفي" },
    { name: "Robert Downey Jr", ar: "روبرت داوني جونيور" },
    { name: "Christian Bale", ar: "كريستيان بيل" },
    { name: "Brad Pitt", ar: "براد بيت" },
    { name: "Tom Cruise", ar: "توم كروز" },
    { name: "Johnny Depp", ar: "جوني ديب" },
    { name: "Denzel Washington", ar: "دينزل واشنطن" },
    { name: "Al Pacino", ar: "آل باتشينو" },
    { name: "Robert De Niro", ar: "روبرت دي نيرو" },
    { name: "Ryan Gosling", ar: "ريان جوسلينج" },
    { name: "Emma Stone", ar: "إيما ستون" },
    { name: "Margot Robbie", ar: "مارجو روبي" },
    { name: "Matthew McConaughey", ar: "ماثيو ماكونهي" },
    { name: "Joaquin Phoenix", ar: "خواكين فينيكس" },
    { name: "Keanu Reeves", ar: "كيانو ريفز" },
    { name: "Morgan Freeman", ar: "مورجان فريمان" },
    { name: "Samuel L. Jackson", ar: "صامويل إل جاكسون" },
    { name: "Daniel Day-Lewis", ar: "دانيال دي لويس" },
    { name: "Heath Ledger", ar: "هيث ليدجر" },
    { name: "Gary Oldman", ar: "جاري أولدمان" },
    { name: "Anthony Hopkins", ar: "أنتوني هوبكنز" },
    { name: "Will Smith", ar: "ويل سميث" },
    { name: "Matt Damon", ar: "مات ديمون" },
    { name: "Christoph Waltz", ar: "كريستوف فالتز" },
    { name: "Jake Gyllenhaal", ar: "جيك جيلنهال" },
    { name: "Meryl Streep", ar: "ميريل ستريب" },
    { name: "Scarlett Johansson", ar: "سكارليت جوهانسون" },
    { name: "Anne Hathaway", ar: "آن هاثاواي" },
    { name: "Natalie Portman", ar: "ناتالي بورتمان" },
    { name: "Zendaya", ar: "زيندايا" },
    { name: "Timothee Chalamet", ar: "تيموثي شالاميه" },
    { name: "Tom Hanks", ar: "توم هانكس" },
    { name: "Robin Williams", ar: "روبن ويليامز" },
    { name: "Jack Nicholson", ar: "جاك نيكلسون" },
    { name: "Marlon Brando", ar: "مارلون براندو" },
    { name: "Joe Pesci", ar: "جو بيشي" },
    { name: "Harrison Ford", ar: "هاريسون فورد" },
    { name: "Clint Eastwood", ar: "كلينت إيستوود" },
    { name: "Sylvester Stallone", ar: "سيلفستر ستالون" },
    { name: "Arnold Schwarzenegger", ar: "أرنولد شوارزنيجر" },
    { name: "Bruce Willis", ar: "بروس ويليس" },
    { name: "Nicolas Cage", ar: "نيكولاس كيج" },
    { name: "Jim Carrey", ar: "جيم كاري" },
    { name: "Adam Sandler", ar: "آدم ساندلر" },
    { name: "Ben Stiller", ar: "بن ستيلر" },
    { name: "Steve Carell", ar: "ستيف كاريل" },
    { name: "Will Ferrell", ar: "ويل فيريل" },
    { name: "Hugh Jackman", ar: "هيو جاكمان" },
    { name: "Chris Hemsworth", ar: "كريس هيمسورث" },
    { name: "Chris Evans", ar: "كريس إيفانز" },
    { name: "Mark Ruffalo", ar: "مارك روفالو" },
    { name: "Tom Hiddleston", ar: "توم هيدلستون" },
    { name: "Benedict Cumberbatch", ar: "بينيديكت كامبرباتش" },
    { name: "Eddie Redmayne", ar: "إيدي ريدماين" },
    { name: "Andrew Garfield", ar: "أندرو جارفيلد" },
    { name: "Tom Holland", ar: "توم هولاند" },
    { name: "Pedro Pascal", ar: "بيدرو باسكال" },
    { name: "Oscar Isaac", ar: "أوسكار إسحاق" },
    { name: "Mads Mikkelsen", ar: "مادس ميكلسن" },
    { name: "Javier Bardem", ar: "خافيير بارديم" },
    { name: "Penelope Cruz", ar: "بينيلوبي كروز" },
    { name: "Cate Blanchett", ar: "كيت بلانشيت" },
    { name: "Charlize Theron", ar: "شارليز ثيرون" },
    { name: "Nicole Kidman", ar: "نيكول كيدمان" },
    { name: "Julia Roberts", ar: "جوليا روبرتس" },
    { name: "Sandra Bullock", ar: "ساندرا بولوك" },
    { name: "Angelina Jolie", ar: "أنجلينا جولي" },
    { name: "Jennifer Aniston", ar: "جينيفر أنيستون" },
    { name: "Jennifer Lawrence", ar: "جينيفر لورانس" },
    { name: "Florence Pugh", ar: "فلورنس بيو" },
    { name: "Anya Taylor-Joy", ar: "آنيا تايلور جوي" },
    { name: "Emily Blunt", ar: "إميلي بلانت" },
    { name: "Jessica Chastain", ar: "جيسيكا شاستين" },
    { name: "Amy Adams", ar: "إيمي آدامز" },
    { name: "Viola Davis", ar: "فيولا ديفيس" },
    { name: "Kate Winslet", ar: "كيت وينسلت" }
  ]
};

// ============================================================================
// NORMALIZATION & STRING UTILITIES
// ============================================================================

/**
 * Normalizes text for exact matching (Layer 1).
 * Removes accents, common articles ("the ", "al-", "el-"), punctuation, extra spaces,
 * and normalizes Arabic letters (أ/إ/آ -> ا, ة -> ه, ى -> ي).
 */
export function normalizeText(str) {
  if (!str) return "";
  let clean = str.toString().trim().toLowerCase();

  // Remove diacritics
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Arabic letter normalization
  clean = clean.replace(/[إأآا]/g, "ا");
  clean = clean.replace(/ة/g, "ه");
  clean = clean.replace(/ى/g, "ي");
  clean = clean.replace(/[\u064B-\u065F]/g, ""); // Arabic Tashkeel/harakat

  // Remove prefixes: "the ", "al-", "el-", "al ", "el ", "al_", "el_"
  clean = clean.replace(/^(the|al-|el-|al\s+|el\s+|al_|el_)/i, "");
  // Arabic "ال" prefix
  if (clean.startsWith("ال") && clean.length > 3) {
    clean = clean.substring(2);
  }

  // Remove all non-alphanumeric (letters, numbers, Arabic script)
  // Keep english a-z, numbers, arabic unicode \u0600-\u06FF, spaces
  clean = clean.replace(/[^\w\s\u0600-\u06FF]/gi, "");

  // Collapse spaces
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function getLevenshteinDistance(a, b) {
  const s1 = a || "";
  const s2 = b || "";
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Searches suggestions based on user query for a specific category.
 * Matches prefix, full name, or Arabic alias.
 * Returns up to maxResults matches.
 */
export function searchSuggestions(category, query, maxResults = 8) {
  if (!query || query.trim().length === 0) return [];
  const list = SUGGESTIONS[category] || [];
  const normalizedQuery = normalizeText(query);
  const rawQuery = query.trim().toLowerCase();

  const results = [];
  for (const item of list) {
    const normName = normalizeText(item.name);
    const normAr = normalizeText(item.ar);
    const rawName = item.name.toLowerCase();
    const rawAr = (item.ar || "").toLowerCase();

    // Check direct starts-with match
    const startsWithEn = normName.startsWith(normalizedQuery) || rawName.startsWith(rawQuery);
    const startsWithAr = normAr.startsWith(normalizedQuery) || rawAr.startsWith(rawQuery);

    // Check contains match
    const containsEn = normName.includes(normalizedQuery) || rawName.includes(rawQuery);
    const containsAr = normAr.includes(normalizedQuery) || rawAr.includes(rawQuery);

    if (startsWithEn || startsWithAr) {
      results.unshift(item); // Prioritize starts-with
    } else if (containsEn || containsAr) {
      results.push(item);
    }

    if (results.length >= maxResults * 2) break;
  }

  // Deduplicate and slice
  const unique = [];
  const seen = new Set();
  for (const res of results) {
    if (!seen.has(res.name)) {
      seen.add(res.name);
      unique.push(res);
      if (unique.length >= maxResults) break;
    }
  }

  return unique;
}
