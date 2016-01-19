Meetings = new Mongo.Collection('meetings');
Members = new Mongo.Collection('members');

if (Meteor.isClient) {
  // This code only runs on the client
  angular.module('signin',['angular-meteor', 'ui.bootstrap']);
  angular.module('signin')
  .controller('signinCtrl', ['$scope', '$meteor', function ($scope, $meteor) {

    // initialize meteor collections
    $scope.meetings = $meteor.collection(function() {
      return Meetings.find({}, { sort: { date: -1 } });
    });
    $scope.allMembers = $meteor.collection(function() {
      return Members.find({});
    });

    // calendar functions

    $scope.open = function($event) {
      $scope.popup.opened = true;
      $event.preventDefault();
      $event.stopPropagation();
    };

    $scope.popup = {
      opened: false
    };

    $scope.curDate = new Date();
    $scope.dateError = "";

    $scope.addDate = function(curDate) {
      // protest if meeting on this date already exists
      if ($scope.meetings.find(function(d) {
        return d.date.toDateString() === curDate.toDateString();
      })) {
        $scope.dateError = "Error: meeting on this date already exists";
      } else {
        // else create new meeting, reset curDate
        $scope.dateError = "";
        $scope.meetings.push({date: curDate, members: []});
        $scope.curDate = new Date();
      }
    };

    $scope.dateOptions = {
      formatYear: 'yy',
      startingDay: 1
    };

    $scope.export = function() {
      var data = [["date", "name", "affiliation", "email"]];
      $scope.meetings.forEach(function(meeting) {
        var dateString = meeting.date.toLocaleDateString();
        meeting.members.forEach(function(memid) {
          var mem = Members.findOne(memid);
          data.push([dateString, mem.name, mem.affiliation, mem.email]);
        });
      });

      var csvContent = "data:text/csv;charset=utf-8,";
      data.forEach(function(infoArray, index){
        var dataString = infoArray.join(",");
        csvContent += index < data.length ? dataString+ "\n" : dataString;
      });
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "attendance.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // navigation

    $scope.frontpage = true;
    $scope.curMeeting = {};

    $scope.showThisMeeting = function(meeting) {
      $scope.curMeeting = meeting;
      $scope.frontpage = false;
    };

    $scope.showFrontpage = function() {
      $scope.frontpage = true;
      $scope.curMeeting = {};
    };

    $scope.removeMeeting = function(meeting) {
      var r = confirm("Are you sure? This cannot be undone.");
      if (r) {
        $scope.meetings.remove(meeting);
      }
    };

    $scope.curMember = {name: "", affiliation: "", email: ""};

    $scope.displayMember = function(id) {
      var mem = Members.findOne(id);
      return mem.name + " (" + mem.affiliation + ")";
    };

    $scope.onMemberSelect = function($item, $model, $label, $event) {
      $scope.curMember = {name: $item.name, affiliation: $item.affiliation, email: $item.email};
    };

    $scope.memberError = "";

    $scope.submitMember = function() {
      // validate inputs
      if ($scope.curMember.name.length === 0) {
        $scope.memberError = "Error: name cannot be blank.";
      } else if ($scope.curMember.affiliation.length === 0) {
        $scope.memberError = "Error: affiliation cannot be blank.";
      } else {
        $scope.memberError = "";
        // insert or update record in database
        Meteor.call('upsertMember', $scope.curMember, function(err) {
          if (err) {
            console.error(err);
          } else {
            var newMember = Members.findOne({name: $scope.curMember.name});
            if (newMember && newMember._id) {
              // find new memberId and push into current meeting's list of members
              // if not already inside
              if (!$scope.curMeeting.members.find(function(i) {
                return i === newMember._id;
              })) {
                $scope.curMeeting.members.splice(0,0,newMember._id);
              }
              $scope.$apply();
              $scope.curMember = {name: "", affiliation: "", email: ""};
            } else {
              console.error("Error: unable to insert member");
            }
          }
        });
      }
    };

    $scope.removeMember = function(idx) {
      var removedMemberId = $scope.curMeeting.members[idx];
      // remove from this meeting
      $scope.curMeeting.members.splice(idx, 1);

      // if member did not come for any other meetings
      // delete from allMembers list as well
      var meetingsWithMember = $scope.meetings.filter(function(meet) {
        return meet.members.find(function(mem) {
          return mem === removedMemberId;
        });
      });
      if (meetingsWithMember.length === 0) {
        var allMembersIdx = $scope.allMembers.findIndex(function(mem) {
          return mem._id === removedMemberId;
        });
        $scope.allMembers.splice(allMembersIdx, 1);
      }
    };

  }]);
}

if (Meteor.isServer) {
  var basicAuth = new HttpBasicAuth(function(user, pass) {
    return user === "origamit" &&
    CryptoJS.SHA1(pass).toString() === "d033e22ae348aeb5660fc2140aec35850c4da997";
  });
  basicAuth.protect();

  Meteor.startup(function () {
    // code to run on server at startup
  });
}

Meteor.methods({
  upsertMember: function(member) {
    var returnValue = Members.upsert({
      name: member.name
    }, {
      $set: {
        affiliation: member.affiliation,
        email: member.email
      }
    });
  }
});
