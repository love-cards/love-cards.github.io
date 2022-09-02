const cards = $("#cards").children();
const card_max_width = 435;

const card_fold_translate = 250

card_width = 1;
card_number = 0;

view_width = 1;
view_height = 1;


// On ready

update_global_values()

cards.each(function() {
  adjust_card_width(this);
})

update_cards_alignment()


// Scroll to card on hash

if(window.location.hash) {
  n = parseInt(window.location.hash.substring(1));
  if (!isNaN(n)) {
    card_number = n
    $("#cards").scrollLeft(n * card_width)
  }
}

addEventListener('hashchange', (event) => {
  n = parseInt(window.location.hash.substring(1));
  if (!isNaN(n)) {
    card_number = n
    $("#cards").animate({'scrollLeft': n * card_width}, 200 * Math.sqrt(n));
  }
});


// Animate cards slide in

cards.each(function(i) {
    let card = this
    let number = Math.max(1, i - card_number)

    setTimeout(function() {
        $(card).css("animation", "0.7s ease 0s 1 slideIn")
    }, number * 100)

    setTimeout(function() {
        $(card).css("opacity", "1")
    }, (number + 1) * 100)
})


// On window resized

$(window).resize(function() {
  update_global_values();

  cards.each(function() {
    adjust_card_width(this);
  });

  update_cards_alignment();
});


function update_global_values() {
  // Use html size istead of window to support mobile top bars
  view_width = $("html").width() 
  view_height = $("html").height() 

  card_width = Math.min(view_width, card_max_width);

  $(":root").css("--view-width", view_width + "px")
  $(":root").css("--view-height", view_height + "px")
}


function update_cards_alignment() {
  let cards_width = 0;
  
  cards.each(function() {
    cards_width = cards_width + $(this).width()
  })
  
  if (Math.round(cards_width) < view_width) {
    $("#cards").css("justify-content", "center")
  } else {
    $("#cards").css("justify-content", "unset")
  }
}


function adjust_card_width() { 
  if (view_width > card_max_width) {
    cards.css("min-width", card_max_width + "px");
    cards.css("max-width", card_max_width + "px");
  } else {
    cards.css("min-width", "100%");
    cards.css("max-width", "100%");
  }
}


// Animate card scrolling

cards.each(function() {
  $(this).scroll(function() {
    let scrolled_x = $(this).scrollLeft();
    let scrolled_y = $(this).scrollTop();

    scroll_percent0 = Math.min(1, scrolled_y / (view_height / 6));
    scroll_percent1 = Math.min(1, scrolled_y / (view_height / 8));
    scroll_percent2 = Math.min(1, scrolled_y / (view_height / 2));

    delta_margin = 14 * (1 - scroll_percent1);
    delta_border_radius = 15 * (1 - scroll_percent1);
    delta_translate = -card_fold_translate * scroll_percent2;

    header = $(this).find(".header");

    header.css("width", `calc(100% - ${delta_margin}px * 2)`);
    header.css("margin", `${delta_margin}px`);
    header.css("border-radius", `${delta_border_radius}px`);
    header.find(".title").css("opacity", 1 - scroll_percent0);
    header.find(".number").css("opacity", 1 - scroll_percent0);

    content = $(this).find(".content");
    content.css("transform", `translate(0px, ${delta_translate}px)`);
  });
});


// Disable left and right scrolling during reading

cards.each(function() {
  $(this).scroll(function() {
    let scrolled = $(this).scrollTop()
    if (scrolled == 0) {
      $("#cards").css("overflow-x", "auto")
    } else {
      $("#cards").css("overflow-x", "hidden")
    }
  })
})


// Fold header top gap 

cards.each(function() {
  let card = this
  $(this).find(".header").on("tapend", function() {
    if (view_width != card_width) { // Disable on mobiles
      if ($(card).scrollTop() < 50) {
        $(card).animate({scrollTop: 0}, 150);
      }
    }
  })
})


// Swipe cards

swipe_started = false
swipe_registered = false
swipe_horizontal = false
swipe_start_scroll_x = 0
swipe_start_scroll_y = 0
swipe_start_x = 0
swipe_start_y = 0
swipe_delta_x = 0
swipe_delta_y = 0


cards.each(function(number) {
  let card = this
  let header = $(card).find(".header")

  // Start
  $(header).on("tapstart", function(e, touch) {
    if ($(card).scrollTop() == 0) {
      swipe_started = true
      swipe_registered = false
      swipe_horizontal = false
      swipe_start_scroll_x = $("#cards").scrollLeft()
      swipe_start_scroll_y = $(card).scrollTop()
      swipe_start_x = touch.position.x
      swipe_start_y = touch.position.y
    }
  })
  
  // Move
  $(header).on("tapmove", function(e, touch) {
    if (!swipe_started) {
      return
    }

    swipe_delta_x = swipe_start_x - touch.position.x
    swipe_delta_y = swipe_start_y - touch.position.y
    
    let delta_x_abs = Math.abs(swipe_delta_x)
    let delta_y_abs = Math.abs(swipe_delta_y)
    
    if (!swipe_registered && (delta_x_abs >= 5 || delta_y_abs >= 5)) {
      swipe_registered = true
      swipe_horizontal = delta_x_abs > delta_y_abs
    }
    
    if (swipe_registered && swipe_horizontal) {
      $("#cards").scrollLeft(swipe_start_scroll_x + swipe_delta_x)
            
      // Animate cards swap
      // let opacity_time = 1 - Math.min(1, delta_x_abs / (card_width * 4))
      let scale = 1 - Math.min(0.2, delta_x_abs / (card_width * 10)) 
      
      // $(this).css("opacity", opacity_time)
      $(this).css("transform", `scale(${scale})`)

      e.preventDefault()
    }    
  })
})


// End cards swap

$("#cards").on("tapend", function(e, touch) {
  if (!swipe_started) {
    return
  }

  swipe_started = false

  if (swipe_horizontal) {
    let delta_x_abs = Math.abs(swipe_delta_x)
    let anchor_card_ind = 0

    if (delta_x_abs >= card_width * 0.2) {
      let dir = Math.sign(swipe_delta_x)
      let cards_scrolled = 1 + Math.floor(delta_x_abs / card_width)
      anchor_card_ind = Math.round(swipe_start_scroll_x / card_width) + cards_scrolled * dir
    } else {
      anchor_card_ind = Math.round(swipe_start_scroll_x / card_width)
    }

    let anchor = anchor_card_ind * card_width

    $("#cards").animate({scrollLeft: anchor}, 200, function() {
      cards.each(function() {
        let header = $(this).find(".header")
        
        $(header).css({
          transition: "transform 0.2s, opacity 0.2s",
          opacity: 1,
          transform: "scale(1)" 
        })
        setTimeout(function() { $(header).css("transition", "none")}, 200)
      })
    })
  }
})

