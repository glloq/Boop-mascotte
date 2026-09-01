# States and transitions

A **State** is a persistent mascot pose. Select a State, then use the same grouped Face Controls used by Rig and Timeline to author its values. Selection previews the State; **Initial State** controls the pose used when the saved mascot starts. New States can capture the current pose, parameter defaults, or an existing State. Duplicating copies only the pose—not transition links.

A **Transition** is a directed permission and an interpolated movement between two States. `Neutral → Happy` does not imply `Happy → Neutral`. The visual graph provides an overview; the DOM transition list provides the complete keyboard-accessible workflow. Duration is stored in milliseconds and easing is limited to the runtime's Linear, Ease In, Ease Out, and Ease In Out curves.

Legacy projects with no entry for a transition source remain unrestricted. The editor does not create empty source entries merely by opening or saving. Once an author explicitly configures a source, its list becomes the allow-list; an explicit empty list denies every transition from that source.

An **Animation** remains independent movement authored over time in the Timeline. Transitions do not launch clips.
